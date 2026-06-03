import { describe, it, expect } from "vitest";
import { ConvexUserRepository } from "@/modules/directory/adapters/convex/convex-user-repository.js";
import { TENANT_A } from "../../_helpers/tenant-context-fixture.js";
import { fromTenantId, fromRoleId } from "@/modules/directory/adapters/convex/mappers.js";
import { roleId } from "@/modules/directory/index.js";
import { createFakeMutationDb, asMutationDb } from "../../_helpers/convex-ctx-fixture.js";

describe("ConvexUserRepository", () => {
  it("creates a user", async () => {
    const mockDb = createFakeMutationDb();
    mockDb.insert.mockResolvedValue("user_123");
    mockDb.get.mockImplementation(async () => {
      return {
        _id: "user_123",
        tenantId: fromTenantId(TENANT_A.tenantId),
        email: "u@u.com",
        name: "u",
        roleId: fromRoleId(roleId("role_1")),
        managerId: null,
        createdAt: 1234,
      };
    });

    const repo = new ConvexUserRepository(asMutationDb(mockDb));
    const user = await repo.create(TENANT_A, {
      email: "u@u.com",
      name: "u",
      roleId: roleId("role_1"),
      managerId: null,
    });

    expect(mockDb.insert).toHaveBeenCalledWith(
      "users",
      expect.objectContaining({
        email: "u@u.com",
      }),
    );
    expect(user.id).toBe("user_123");
  });
});
