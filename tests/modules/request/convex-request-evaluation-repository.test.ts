import { describe, it, expect, vi } from "vitest";
import { ConvexRequestEvaluationRepository } from "@/modules/request/adapters/convex/convex-request-evaluation-repository.js";
import { TENANT_A } from "../../_helpers/tenant-context-fixture.js";
import { fromTenantId } from "@/modules/directory/adapters/convex/mappers.js";
import { createFakeMutationDb, asQueryDb } from "../../_helpers/convex-ctx-fixture.js";
import { fromPolicyVersionId } from "@/modules/policy/adapters/convex/mappers.js";
import { policyVersionId } from "@/modules/policy/index.js";

describe("ConvexRequestEvaluationRepository - findByTenant", () => {
  it("returns only evaluations matching the tenant context and uses by_tenant_created index", async () => {
    const mockDb = createFakeMutationDb();
    const collectMock = vi.fn().mockResolvedValue([
      {
        _id: "req_1",
        tenantId: fromTenantId(TENANT_A.tenantId),
        requesterId: null,
        requestType: "type1",
        requestInput: {},
        policyVersionId: fromPolicyVersionId(policyVersionId("v1")),
        decision: null,
        trace: [],
        status: "completed",
        errorCode: null,
        fieldPath: null,
        createdAt: 1234,
      }
    ]);
    const withIndexMock = vi.fn().mockReturnValue({ collect: collectMock });
    mockDb.query.mockReturnValue({ withIndex: withIndexMock });

    const repo = new ConvexRequestEvaluationRepository(asQueryDb(mockDb));
    const result = await repo.findByTenant(TENANT_A);

    expect(mockDb.query).toHaveBeenCalledWith("requestEvaluations");
    expect(withIndexMock).toHaveBeenCalledWith("by_tenant_created", expect.any(Function));

    const qCallback = withIndexMock.mock.calls[0]![1];
    const eqMock = vi.fn().mockReturnValue("q_chain");
    const qObj = { eq: eqMock };
    const qResult = qCallback(qObj);

    expect(eqMock).toHaveBeenCalledWith("tenantId", fromTenantId(TENANT_A.tenantId));
    expect(qResult).toBe("q_chain");

    expect(result.length).toBe(1);
    expect(result[0]!.id).toBe("req_1");
  });
});
