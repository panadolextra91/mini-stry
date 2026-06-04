import { describe, it, expect, vi } from "vitest";
import { ConvexPolicyRepository } from "@/modules/policy/adapters/convex/convex-policy-repository.js";
import { TENANT_A } from "../../_helpers/tenant-context-fixture.js";
import { fromTenantId } from "@/modules/directory/adapters/convex/mappers.js";
import { createFakeMutationDb, asQueryDb } from "../../_helpers/convex-ctx-fixture.js";

describe("ConvexPolicyRepository - listByTenant", () => {
  it("returns only policies matching the tenant context and uses by_tenant_name index", async () => {
    const mockDb = createFakeMutationDb();
    const takeMock = vi.fn().mockResolvedValue([
      {
        _id: "pol_1",
        tenantId: fromTenantId(TENANT_A.tenantId),
        name: "Policy 1",
        requestType: "type1",
        activeVersionId: null,
        createdAt: 1234,
      }
    ]);
    const orderMock = vi.fn().mockReturnValue({ take: takeMock });
    const withIndexMock = vi.fn().mockReturnValue({ order: orderMock });
    mockDb.query.mockReturnValue({ withIndex: withIndexMock });

    const repo = new ConvexPolicyRepository(asQueryDb(mockDb));
    const result = await repo.listByTenant(TENANT_A);

    expect(mockDb.query).toHaveBeenCalledWith("policies");
    expect(withIndexMock).toHaveBeenCalledWith("by_tenant_name", expect.any(Function));

    const qCallback = withIndexMock.mock.calls[0]![1];
    const eqMock = vi.fn().mockReturnValue("q_chain");
    const qObj = { eq: eqMock };
    const qResult = qCallback(qObj);

    expect(eqMock).toHaveBeenCalledWith("tenantId", fromTenantId(TENANT_A.tenantId));
    expect(qResult).toBe("q_chain");

    expect(result.length).toBe(1);
    expect(result[0]!.id).toBe("pol_1");
  });
});
