import { describe, it, expect, vi } from "vitest";
import { ConvexPolicyVersionRepository } from "@/modules/policy/adapters/convex/convex-policy-version-repository.js";
import { TENANT_A } from "../../_helpers/tenant-context-fixture.js";
import { fromTenantId } from "@/modules/directory/adapters/convex/mappers.js";
import { fromPolicyId } from "@/modules/policy/adapters/convex/mappers.js";
import { policyId } from "@/modules/policy/index.js";
import { createFakeMutationDb, asQueryDb } from "../../_helpers/convex-ctx-fixture.js";

describe("ConvexPolicyVersionRepository - listByPolicy", () => {
  it("returns only policy versions matching the tenant context and policyId and uses by_tenant_policy_version index", async () => {
    const mockDb = createFakeMutationDb();
    const takeMock = vi.fn().mockResolvedValue([
      {
        _id: "pver_1",
        tenantId: fromTenantId(TENANT_A.tenantId),
        policyId: fromPolicyId(policyId("pol_1")),
        versionNumber: 1,
        content: {},
        status: "draft",
        validationStatus: "valid",
        validationErrors: [],
        revision: 0,
        rollbackFromVersionId: null,
        createdBy: "user_1",
        publishedAt: null,
      }
    ]);
    const orderMock = vi.fn().mockReturnValue({ take: takeMock });
    const withIndexMock = vi.fn().mockReturnValue({ order: orderMock });
    mockDb.query.mockReturnValue({ withIndex: withIndexMock });

    const repo = new ConvexPolicyVersionRepository(asQueryDb(mockDb));
    const targetPolicyId = policyId("pol_1");
    const result = await repo.listByPolicy(TENANT_A, targetPolicyId);

    expect(mockDb.query).toHaveBeenCalledWith("policyVersions");
    expect(withIndexMock).toHaveBeenCalledWith("by_tenant_policy_version", expect.any(Function));

    const qCallback = withIndexMock.mock.calls[0]![1];
    const eqMock2 = vi.fn().mockReturnValue("q_chain");
    const eqMock1 = vi.fn().mockReturnValue({ eq: eqMock2 });
    const qObj = { eq: eqMock1 };
    const qResult = qCallback(qObj);

    expect(eqMock1).toHaveBeenCalledWith("tenantId", fromTenantId(TENANT_A.tenantId));
    expect(eqMock2).toHaveBeenCalledWith("policyId", fromPolicyId(targetPolicyId));
    expect(qResult).toBe("q_chain");

    expect(result.length).toBe(1);
    expect(result[0]!.id).toBe("pver_1");
  });
});
