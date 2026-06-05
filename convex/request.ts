/**
 * convex/ HARD RULE:
 * Allowed: validate input shape, instantiate dependencies, call application services, map responses.
 * Forbidden: evaluate policies, enforce business rules, perform approval routing, contain domain logic.
 */
import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import { EventDispatcher } from "../src/shared/event-dispatcher.js";
import { PolicyService } from "../src/modules/policy/index.js";
import type { PolicyEventMap } from "../src/modules/policy/index.js";
import { ConvexPolicyRepository } from "../src/modules/policy/adapters/convex/convex-policy-repository.js";
import { ConvexPolicyVersionRepository } from "../src/modules/policy/adapters/convex/convex-policy-version-repository.js";
import { AjvSchemaValidator } from "../src/modules/runtime/index.js";
import { RequestAuditSubscriber, ConvexAuditLogRepository } from "../src/modules/audit/index.js";
import {
  PolicyRuntimeService,
  ConvexRequestEvaluationRepository,
  requestEvaluationId,
} from "../src/modules/request/index.js";
import type { RequestEventMap } from "../src/modules/request/index.js";
import { tenantContext, tenantId, userId } from "../src/modules/directory/index.js";
import { ConvexUserRepository } from "../src/modules/directory/adapters/convex/convex-user-repository.js";
import { ConvexRoleRepository } from "../src/modules/directory/adapters/convex/convex-role-repository.js";
import {
  ApprovalRoutingService,
  ApprovalAuditSubscriber,
  ConvexApprovalChainRepository,
  ConvexApprovalTaskRepository,
} from "../src/modules/approval/index.js";
import type { ApprovalEventMap } from "../src/modules/approval/index.js";

export const submitRequest = mutation({
  args: {
    tenantId: v.string(),
    actorId: v.string(),
    requestType: v.string(),
    context: v.any(),
  },
  handler: async (ctx, args) => {
    const requestDispatcher = new EventDispatcher<RequestEventMap>();
    const auditRepo = new ConvexAuditLogRepository(ctx.db);
    // Wired via constructor side-effect
    void new RequestAuditSubscriber(auditRepo, requestDispatcher);

    const policyDispatcher = new EventDispatcher<PolicyEventMap>();
    const policyRepo = new ConvexPolicyRepository(ctx.db);
    const versionRepo = new ConvexPolicyVersionRepository(ctx.db);
    const policyValidator = new AjvSchemaValidator();
    const policyService = new PolicyService(
      policyRepo,
      versionRepo,
      policyValidator,
      policyDispatcher,
    );

    const runtimeValidator = new AjvSchemaValidator();
    const evalRepo = new ConvexRequestEvaluationRepository(ctx.db);
    const service = new PolicyRuntimeService(
      policyService,
      runtimeValidator,
      evalRepo,
      requestDispatcher,
    );

    const userRepo = new ConvexUserRepository(ctx.db);
    const roleRepo = new ConvexRoleRepository(ctx.db);
    const chainRepo = new ConvexApprovalChainRepository(ctx.db);
    const taskRepo = new ConvexApprovalTaskRepository(ctx.db);

    const approvalDispatcher = new EventDispatcher<ApprovalEventMap>();
    void new ApprovalAuditSubscriber(auditRepo, approvalDispatcher);

    const routingService = new ApprovalRoutingService(
      chainRepo,
      taskRepo,
      userRepo,
      roleRepo,
      evalRepo,
      approvalDispatcher,
    );

    const tCtx = tenantContext(tenantId(args.tenantId), userId(args.actorId));

    requestDispatcher.on("RequestEvaluated", (e) => {
      return routingService.onRequestEvaluated(tCtx, e);
    });

    return service.submit(tCtx, {
      requestType: args.requestType,
      context: args.context,
    });
  },
});

export const getRequestEvaluation = query({
  args: {
    tenantId: v.string(),
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const evalRepo = new ConvexRequestEvaluationRepository(ctx.db);
    const tCtx = tenantContext(tenantId(args.tenantId));
    return evalRepo.findById(tCtx, requestEvaluationId(args.id));
  },
});

export const listRequests = query({
  args: {
    tenantId: v.string(),
  },
  handler: async (ctx, args) => {
    const evalRepo = new ConvexRequestEvaluationRepository(ctx.db);
    const tCtx = tenantContext(tenantId(args.tenantId));
    return evalRepo.findByTenant(tCtx);
  },
});
