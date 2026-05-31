import { describe, it, expect, vi } from "vitest";
import { ConvexRoleRepository } from "@/modules/directory/adapters/convex/convex-role-repository.js";
import { TENANT_A } from "../../_helpers/tenant-context-fixture.js";
import { fromTenantId } from "@/modules/directory/adapters/convex/mappers.js";
import { createFakeMutationDb, asMutationDb, asQueryDb } from "../../_helpers/convex-ctx-fixture.js";

describe("ConvexRoleRepository", () => {
  it("creates a role and fetches it", async () => {
    const mockDb = createFakeMutationDb();
    mockDb.insert.mockResolvedValue("role_123");
    mockDb.get.mockImplementation(async () => {
      return { _id: "role_123", tenantId: fromTenantId(TENANT_A.tenantId), name: "admin", createdAt: 1234 };
    });

    const repo = new ConvexRoleRepository(asMutationDb(mockDb));
    const role = await repo.create(TENANT_A, { name: "admin" });
    
    expect(mockDb.insert).toHaveBeenCalledWith("roles", expect.objectContaining({
      name: "admin",
      tenantId: fromTenantId(TENANT_A.tenantId)
    }));
    expect(role.name).toBe("admin");
    expect(role.id).toBe("role_123");
  });

  it("lists roles using index", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([{ _id: "role_123", tenantId: fromTenantId(TENANT_A.tenantId), name: "admin", createdAt: 1234 }]),
    };
    const mockDb = createFakeMutationDb();
    mockDb.query.mockReturnValue(mockQuery as unknown as ReturnType<typeof mockDb.query>);

    const repo = new ConvexRoleRepository(asQueryDb(mockDb));
    const roles = await repo.listByTenant(TENANT_A);
    expect(roles).toHaveLength(1);
    
    const role = roles[0];
    expect(role).toBeDefined();
    if (!role) throw new Error("unreachable");
    expect(role.name).toBe("admin");
  });
});
