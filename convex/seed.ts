import { internalMutation } from "./_generated/server.js";
import { EventDispatcher } from "../src/shared/event-dispatcher.js";
import { ConvexTenantRepository } from "../src/modules/directory/adapters/convex/convex-tenant-repository.js";
import { ConvexRoleRepository } from "../src/modules/directory/adapters/convex/convex-role-repository.js";
import { ConvexUserRepository } from "../src/modules/directory/adapters/convex/convex-user-repository.js";
import { RoleService, UserService, tenantContext } from "../src/modules/directory/index.js";
import { ConvexAuditLogRepository, AuditEventSubscriber, RequestAuditSubscriber } from "../src/modules/audit/index.js";
import { ConvexPolicyRepository, ConvexPolicyVersionRepository, PolicyService } from "../src/modules/policy/index.js";
import type { PolicyEventMap } from "../src/modules/policy/index.js";
import { AjvSchemaValidator } from "../src/modules/runtime/index.js";
import { ConvexRequestEvaluationRepository, PolicyRuntimeService } from "../src/modules/request/index.js";
import type { RequestEventMap } from "../src/modules/request/index.js";
import { ConvexApprovalChainRepository, ConvexApprovalTaskRepository, ApprovalRoutingService, ApprovalAuditSubscriber } from "../src/modules/approval/index.js";
import type { ApprovalEventMap } from "../src/modules/approval/index.js";

export const seedDemoData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("tenants").first();
    if (existing) return { seeded: false };

    // Setup repos & services
    const tenantRepo = new ConvexTenantRepository(ctx.db);
    const roleRepo = new ConvexRoleRepository(ctx.db);
    const userRepo = new ConvexUserRepository(ctx.db);
    const roleService = new RoleService(roleRepo);
    const userService = new UserService(userRepo, roleRepo);

    // Create Tenant 1 (Acme Corp)
    const tenant1 = await tenantRepo.create({ name: "Acme Corp" });
    const tCtx1 = tenantContext(tenant1.id);

    // Create Roles for Tenant 1
    const requesterRole1 = await roleService.createRole(tCtx1, { name: "Requester" });
    const managerRole1 = await roleService.createRole(tCtx1, { name: "Manager" });
    const adminRole1 = await roleService.createRole(tCtx1, { name: "Admin" });

    // Create Users for Tenant 1
    // Approver (Manager)
    const manager1 = await userService.createUser(tCtx1, {
      email: "manager@acme.corp",
      name: "Acme Manager",
      roleId: managerRole1.id,
      managerId: null,
    });
    // Requester (reports to manager)
    const requester1 = await userService.createUser(tCtx1, {
      email: "requester@acme.corp",
      name: "Acme Requester",
      roleId: requesterRole1.id,
      managerId: manager1.id,
    });
    // Admin
    const admin1 = await userService.createUser(tCtx1, {
      email: "admin@acme.corp",
      name: "Acme Admin",
      roleId: adminRole1.id,
      managerId: null,
    });

    // Create Tenant 2 (Stark Industries)
    const tenant2 = await tenantRepo.create({ name: "Stark Industries" });
    const tCtx2 = tenantContext(tenant2.id);

    const employeeRole2 = await roleService.createRole(tCtx2, { name: "Employee" });
    const directorRole2 = await roleService.createRole(tCtx2, { name: "Director" });

    const director2 = await userService.createUser(tCtx2, {
      email: "director@stark.com",
      name: "Stark Director",
      roleId: directorRole2.id,
      managerId: null,
    });
    await userService.createUser(tCtx2, {
      email: "employee@stark.com",
      name: "Stark Employee",
      roleId: employeeRole2.id,
      managerId: director2.id,
    });

    // Setup Policy Services
    const policyDispatcher = new EventDispatcher<PolicyEventMap>();
    const auditRepo = new ConvexAuditLogRepository(ctx.db);
    void new AuditEventSubscriber(auditRepo, policyDispatcher);

    const policyRepo = new ConvexPolicyRepository(ctx.db);
    const versionRepo = new ConvexPolicyVersionRepository(ctx.db);
    const policyValidator = new AjvSchemaValidator();
    const policyService = new PolicyService(policyRepo, versionRepo, policyValidator, policyDispatcher);

    // Acme Policy: Expense Approval
    const tCtx1Admin = tenantContext(tenant1.id, admin1.id);
    const policy1 = await policyService.createPolicy(tCtx1Admin, {
      name: "Expense Policy",
      requestType: "expense",
    });

    const policyContent = {
      rules: [
        {
          id: "manager-approval",
          when: {
            type: "compare",
            field: "amount",
            op: "gt",
            value: 0
          },
          decision: {
            kind: "request-approval",
            targetRoleId: managerRole1.id
          }
        }
      ],
      defaultDecision: {
        kind: "auto-approve"
      }
    };

    const draft1 = await policyService.createDraft(tCtx1Admin, policy1.id, policyContent, admin1.id);
    await policyService.publishDraft(tCtx1Admin, draft1.id);

    // Submit Request (trigger evaluation + approval chain)
    const requestDispatcher = new EventDispatcher<RequestEventMap>();
    void new RequestAuditSubscriber(auditRepo, requestDispatcher);

    const runtimeValidator = new AjvSchemaValidator();
    const evalRepo = new ConvexRequestEvaluationRepository(ctx.db);
    const runtimeService = new PolicyRuntimeService(policyService, runtimeValidator, evalRepo, requestDispatcher);

    const chainRepo = new ConvexApprovalChainRepository(ctx.db);
    const taskRepo = new ConvexApprovalTaskRepository(ctx.db);
    const approvalDispatcher = new EventDispatcher<ApprovalEventMap>();
    void new ApprovalAuditSubscriber(auditRepo, approvalDispatcher);
    
    const routingService = new ApprovalRoutingService(chainRepo, taskRepo, userRepo, roleRepo, evalRepo, approvalDispatcher);
    
    requestDispatcher.on("RequestEvaluated", (e) => {
      return routingService.onRequestEvaluated(tCtx1, e);
    });

    const tCtx1Requester = tenantContext(tenant1.id, requester1.id);
    await runtimeService.submit(tCtx1Requester, {
      requestType: "expense",
      context: { amount: 150 }
    });

    return { seeded: true };
  }
});
