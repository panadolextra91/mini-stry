import type {
  TenantContext,
  UserRepositoryPort,
  RoleRepositoryPort,
} from "@/modules/directory/index.js";

export async function setupManagerHierarchy(
  ctx: TenantContext,
  userRepo: UserRepositoryPort,
  roleRepo: RoleRepositoryPort,
) {
  // Create roles
  const approverRole = await roleRepo.create(ctx, { name: "Approver Role" });
  const standardRole = await roleRepo.create(ctx, { name: "Standard Role" });

  const approverRoleId = approverRole.id;
  const standardRoleId = standardRole.id;

  // 1. Walk hit scenario
  // requester_hit -> manager_1 (standard) -> manager_2 (approver)
  const manager2 = await userRepo.create(ctx, {
    email: "manager2@test.com",
    name: "Manager 2",
    roleId: approverRoleId,
    managerId: null,
  });

  const manager1 = await userRepo.create(ctx, {
    email: "manager1@test.com",
    name: "Manager 1",
    roleId: standardRoleId,
    managerId: manager2.id,
  });

  const requesterHit = await userRepo.create(ctx, {
    email: "requester_hit@test.com",
    name: "Requester Hit",
    roleId: standardRoleId,
    managerId: manager1.id,
  });

  // 2. Walk miss scenario
  // requester_miss -> manager_3 (standard) -> null
  const manager3 = await userRepo.create(ctx, {
    email: "manager3@test.com",
    name: "Manager 3",
    roleId: standardRoleId,
    managerId: null,
  });

  const requesterMiss = await userRepo.create(ctx, {
    email: "requester_miss@test.com",
    name: "Requester Miss",
    roleId: standardRoleId,
    managerId: manager3.id,
  });

  // 3. Self-exclusion scenario
  // requester_self (approver) -> manager_4 (standard) -> null
  const manager4 = await userRepo.create(ctx, {
    email: "manager4@test.com",
    name: "Manager 4",
    roleId: standardRoleId,
    managerId: null,
  });

  const requesterSelf = await userRepo.create(ctx, {
    email: "requester_self@test.com",
    name: "Requester Self",
    roleId: approverRoleId,
    managerId: manager4.id,
  });

  // 4. Deep chain (>50 hops) scenario
  // requester_deep -> 52 managers -> null
  let lastManagerId = null;
  for (let i = 52; i >= 1; i--) {
    const mgr = await userRepo.create(ctx, {
      email: `deep_mgr_${i}@test.com`,
      name: `Deep Manager ${i}`,
      roleId: standardRoleId,
      managerId: lastManagerId,
    });
    lastManagerId = mgr.id;
  }

  const requesterDeep = await userRepo.create(ctx, {
    email: "requester_deep@test.com",
    name: "Requester Deep",
    roleId: standardRoleId,
    managerId: lastManagerId,
  });

  return {
    approverRoleId,
    standardRoleId,
    requesterHitId: requesterHit.id,
    expectedApproverId: manager2.id,
    requesterMissId: requesterMiss.id,
    requesterSelfId: requesterSelf.id,
    requesterDeepId: requesterDeep.id,
  };
}
