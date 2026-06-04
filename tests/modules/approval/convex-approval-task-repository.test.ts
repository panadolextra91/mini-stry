import { describe, it, expect, vi } from "vitest";
import { ConvexApprovalTaskRepository } from "@/modules/approval/adapters/convex/convex-approval-task-repository.js";
import { TENANT_A } from "../../_helpers/tenant-context-fixture.js";
import { fromTenantId } from "@/modules/directory/adapters/convex/mappers.js";
import { fromUserId } from "@/modules/directory/adapters/convex/mappers.js";
import { userId } from "@/modules/directory/index.js";
import { createFakeMutationDb, asQueryDb } from "../../_helpers/convex-ctx-fixture.js";

describe("ConvexApprovalTaskRepository - findByApprover", () => {
  it("returns only tasks matching the tenant context and approverId and uses by_tenant_approver index", async () => {
    const mockDb = createFakeMutationDb();
    const takeMock = vi.fn().mockResolvedValue([
      {
        _id: "task_1",
        tenantId: fromTenantId(TENANT_A.tenantId),
        chainId: "chain_1",
        stageNumber: 1,
        approverId: fromUserId(userId("app_1")),
        approverRoleId: "role_1",
        state: "PENDING",
        createdAt: 1234,
      }
    ]);
    const orderMock = vi.fn().mockReturnValue({ take: takeMock });
    const withIndexMock = vi.fn().mockReturnValue({ order: orderMock });
    mockDb.query.mockReturnValue({ withIndex: withIndexMock });

    const repo = new ConvexApprovalTaskRepository(asQueryDb(mockDb));
    const targetApproverId = userId("app_1");
    const result = await repo.findByApprover(TENANT_A, targetApproverId);

    expect(mockDb.query).toHaveBeenCalledWith("approvalTasks");
    expect(withIndexMock).toHaveBeenCalledWith("by_tenant_approver", expect.any(Function));

    const qCallback = withIndexMock.mock.calls[0]![1];
    const eqMock2 = vi.fn().mockReturnValue("q_chain");
    const eqMock1 = vi.fn().mockReturnValue({ eq: eqMock2 });
    const qObj = { eq: eqMock1 };
    const qResult = qCallback(qObj);

    expect(eqMock1).toHaveBeenCalledWith("tenantId", fromTenantId(TENANT_A.tenantId));
    expect(eqMock2).toHaveBeenCalledWith("approverId", fromUserId(targetApproverId));
    expect(qResult).toBe("q_chain");

    expect(result.length).toBe(1);
    expect(result[0]!.id).toBe("task_1");
  });
});
