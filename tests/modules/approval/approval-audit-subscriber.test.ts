import { describe, it, expect } from "vitest";
import { setupApproval } from "../../_helpers/in-memory-fakes.js";
import { TENANT_A } from "../../_helpers/tenant-context-fixture.js";
import { AjvSchemaValidator } from "@/modules/runtime/index.js";
import { userId } from "@/modules/directory/index.js";
import { approvalChainId, approvalTaskId } from "@/modules/approval/index.js";
import { requestEvaluationId } from "@/modules/request/index.js";

describe("ApprovalAuditSubscriber", () => {
  it("creates by-reference audit record on ApprovalTaskApproved event", async () => {
    const { approvalDispatcher, auditRepo } = setupApproval(new AjvSchemaValidator());

    const tId = TENANT_A.tenantId;
    const taskId = approvalTaskId("task_1");
    const chainId = approvalChainId("chain_1");
    const actorId = userId("user_approver");
    const timestamp = Date.now();

    await approvalDispatcher.emit("ApprovalTaskApproved", {
      tenantId: tId,
      taskId,
      chainId,
      actorId,
      timestamp,
    });

    const logs = await auditRepo.findByTenant(TENANT_A);
    const approvalLogs = logs.filter((l) => l.eventType.startsWith("approval."));
    expect(approvalLogs).toHaveLength(1);
    expect(approvalLogs[0]!.eventType).toBe("approval.task_approved");

    const payload = approvalLogs[0]!.payload as Record<string, unknown>;
    expect(payload.tenantId).toBe(tId);
    expect(payload.taskId).toBe(taskId);
    expect(payload.chainId).toBe(chainId);
    expect(payload.actorId).toBe(actorId);

    // Assert only by-reference IDs: no decision or request content exists
    expect(payload.requestInput).toBeUndefined();
    expect(payload.decision).toBeUndefined();
    expect(payload.trace).toBeUndefined();
  });

  it("creates by-reference audit record on ApprovalTaskRejected event", async () => {
    const { approvalDispatcher, auditRepo } = setupApproval(new AjvSchemaValidator());

    const tId = TENANT_A.tenantId;
    const taskId = approvalTaskId("task_1");
    const chainId = approvalChainId("chain_1");
    const actorId = userId("user_approver");
    const timestamp = Date.now();

    await approvalDispatcher.emit("ApprovalTaskRejected", {
      tenantId: tId,
      taskId,
      chainId,
      actorId,
      timestamp,
    });

    const logs = await auditRepo.findByTenant(TENANT_A);
    const approvalLogs = logs.filter((l) => l.eventType.startsWith("approval."));
    expect(approvalLogs).toHaveLength(1);
    expect(approvalLogs[0]!.eventType).toBe("approval.task_rejected");

    const payload = approvalLogs[0]!.payload as Record<string, unknown>;
    expect(payload.tenantId).toBe(tId);
    expect(payload.taskId).toBe(taskId);
    expect(payload.chainId).toBe(chainId);
    expect(payload.actorId).toBe(actorId);

    // Assert only by-reference IDs: no decision or request content exists
    expect(payload.requestInput).toBeUndefined();
    expect(payload.decision).toBeUndefined();
    expect(payload.trace).toBeUndefined();
  });

  it("creates by-reference audit record on ApprovalRoutingFailed event", async () => {
    const { approvalDispatcher, auditRepo } = setupApproval(new AjvSchemaValidator());

    const tId = TENANT_A.tenantId;
    const evaluationRecordId = requestEvaluationId("eval_1");
    const reason = "no manager in the chain has the required role";
    const timestamp = Date.now();

    await approvalDispatcher.emit("ApprovalRoutingFailed", {
      tenantId: tId,
      evaluationRecordId,
      reason,
      timestamp,
    });

    const logs = await auditRepo.findByTenant(TENANT_A);
    const approvalLogs = logs.filter((l) => l.eventType.startsWith("approval."));
    expect(approvalLogs).toHaveLength(1);
    expect(approvalLogs[0]!.eventType).toBe("approval.routing_failed");

    const payload = approvalLogs[0]!.payload as Record<string, unknown>;
    expect(payload.tenantId).toBe(tId);
    expect(payload.evaluationRecordId).toBe(evaluationRecordId);
    expect(payload.reason).toBe(reason);

    // Assert only by-reference IDs: no decision or request content exists
    expect(payload.requestInput).toBeUndefined();
    expect(payload.decision).toBeUndefined();
    expect(payload.trace).toBeUndefined();
  });
});
