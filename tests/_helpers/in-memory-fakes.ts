import { InMemoryTenantRepository } from "@/modules/directory/adapters/memory/in-memory-tenant-repository.js";
import { InMemoryRoleRepository } from "@/modules/directory/adapters/memory/in-memory-role-repository.js";
import { InMemoryUserRepository } from "@/modules/directory/adapters/memory/in-memory-user-repository.js";
import { RoleService, UserService } from "@/modules/directory/index.js";
import { InMemoryPolicyRepository } from "@/modules/policy/adapters/memory/in-memory-policy-repository.js";
import { InMemoryPolicyVersionRepository } from "@/modules/policy/adapters/memory/in-memory-policy-version-repository.js";
import { PolicyService, EventDispatcher } from "@/modules/policy/index.js";
import type { PolicyEventMap } from "@/modules/policy/index.js";
import type { SchemaValidatorPort } from "@/modules/runtime/index.js";
import { InMemoryAuditLogRepository, AuditEventSubscriber } from "@/modules/audit/index.js";

export function setupDirectory() {
  const tenantRepo = new InMemoryTenantRepository();
  const roleRepo = new InMemoryRoleRepository();
  const userRepo = new InMemoryUserRepository();
  const roleService = new RoleService(roleRepo);
  const userService = new UserService(userRepo, roleRepo);
  
  return { tenantRepo, roleRepo, userRepo, roleService, userService };
}

export function setupPolicy(validator: SchemaValidatorPort) {
  const policyRepo = new InMemoryPolicyRepository();
  const versionRepo = new InMemoryPolicyVersionRepository();
  const dispatcher = new EventDispatcher<PolicyEventMap>();
  const auditRepo = new InMemoryAuditLogRepository();
  const _auditSubscriber = new AuditEventSubscriber(auditRepo, dispatcher);
  const policyService = new PolicyService(
    policyRepo,
    versionRepo,
    validator,
    dispatcher,
  );

  return { policyRepo, versionRepo, policyService, dispatcher, auditRepo };
}
