import { describe, it, expect, beforeEach } from "vitest";
import { setupDirectory } from "../../_helpers/in-memory-fakes.js";
import { TENANT_A, TENANT_B } from "../../_helpers/tenant-context-fixture.js";
import { RoleNotFoundError, UserNotFoundError, roleId, userId } from "@/modules/directory/index.js";
import { ConvexRoleRepository } from "@/modules/directory/adapters/convex/convex-role-repository.js";
import { ConvexUserRepository } from "@/modules/directory/adapters/convex/convex-user-repository.js";
import { createFakeMutationDb, asMutationDb } from "../../_helpers/convex-ctx-fixture.js";
import { fromTenantId } from "@/modules/directory/adapters/convex/mappers.js";

describe("Tenant Isolation", () => {
  let { roleService, userService } = setupDirectory();

  beforeEach(() => {
    const fakes = setupDirectory();
    roleService = fakes.roleService;
    userService = fakes.userService;
  });

  it("prevents Tenant B from seeing Tenant A's roles", async () => {
    const roleA = await roleService.createRole(TENANT_A, { name: "admin" });
    const foundById = await roleService.findRoleById(TENANT_B, roleA.id);
    expect(foundById).toBeNull();

    const foundByName = await roleService.findRoleByName(TENANT_B, "admin");
    expect(foundByName).toBeNull();

    const rolesB = await roleService.listRolesByTenant(TENANT_B);
    expect(rolesB).toHaveLength(0);
  });

  it("prevents Tenant B from seeing Tenant A's users", async () => {
    const roleA = await roleService.createRole(TENANT_A, { name: "admin" });
    const userA = await userService.createUser(TENANT_A, {
      email: "a@a.com",
      name: "A",
      roleId: roleA.id,
      managerId: null,
    });

    const foundById = await userService.findUserById(TENANT_B, userA.id);
    expect(foundById).toBeNull();

    const foundByEmail = await userService.findUserByEmail(TENANT_B, "a@a.com");
    expect(foundByEmail).toBeNull();

    const usersB = await userService.listUsersByTenant(TENANT_B);
    expect(usersB).toHaveLength(0);
  });

  it("prevents cross-tenant profile updates", async () => {
    const roleA = await roleService.createRole(TENANT_A, { name: "admin" });
    const userA = await userService.createUser(TENANT_A, {
      email: "a@a.com",
      name: "A",
      roleId: roleA.id,
      managerId: null,
    });

    await expect(userService.updateUserProfile(TENANT_B, userA.id, { name: "B" })).rejects.toThrow(
      UserNotFoundError,
    );
  });

  it("prevents cross-tenant role assignment", async () => {
    const roleA = await roleService.createRole(TENANT_A, { name: "admin" });
    const userA = await userService.createUser(TENANT_A, {
      email: "a@a.com",
      name: "A",
      roleId: roleA.id,
      managerId: null,
    });
    const roleB = await roleService.createRole(TENANT_B, { name: "admin" });

    // Try to assign Tenant B's role to Tenant A's user (using Tenant A's context)
    await expect(userService.assignRole(TENANT_A, userA.id, roleB.id)).rejects.toThrow(
      RoleNotFoundError,
    );
  });
});

describe("Adapter-Level Belt-and-Braces Tenant Isolation", () => {
  it("prevents cross-tenant modifications on ConvexRoleRepository", async () => {
    const mockDb = createFakeMutationDb();
    mockDb.get.mockResolvedValue({
      _id: "role_1",
      tenantId: fromTenantId(TENANT_B.tenantId),
      name: "admin",
      createdAt: 1234,
    });
    const repo = new ConvexRoleRepository(asMutationDb(mockDb));

    await expect(repo.rename(TENANT_A, roleId("role_1"), "x")).rejects.toThrow(
      /not found in tenant/,
    );
    await expect(repo.delete(TENANT_A, roleId("role_1"))).rejects.toThrow(/not found in tenant/);
  });

  it("prevents cross-tenant modifications on ConvexUserRepository", async () => {
    const mockDb = createFakeMutationDb();
    mockDb.get.mockResolvedValue({
      _id: "user_1",
      tenantId: fromTenantId(TENANT_B.tenantId),
      email: "b@b.com",
      name: "b",
      roleId: "role_1",
      managerId: null,
      createdAt: 1234,
    });
    const repo = new ConvexUserRepository(asMutationDb(mockDb));

    await expect(repo.updateProfile(TENANT_A, userId("user_1"), { name: "x" })).rejects.toThrow(
      /not found in tenant/,
    );
    await expect(repo.updateRole(TENANT_A, userId("user_1"), roleId("role_2"))).rejects.toThrow(
      /not found in tenant/,
    );
    await expect(
      repo.updateManagerId(TENANT_A, userId("user_1"), userId("manager_1")),
    ).rejects.toThrow(/not found in tenant/);
    await expect(repo.delete(TENANT_A, userId("user_1"))).rejects.toThrow(/not found in tenant/);
  });
});
