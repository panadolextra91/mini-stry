import type { AuditLogRepositoryPort } from "@/modules/audit/index.js";
import type { TenantContext } from "@/modules/directory/index.js";
import type { EventDispatcher } from "@/shared/event-dispatcher.js";
import type { ApprovalEventMap } from "../domain/approval-events.js";

/**
 * ApprovalAuditSubscriber wires to ApprovalEventMap events via EventDispatcher
 * and persists by-reference audit records (D-37, D-53, D-54).
 *
 * Payload details:
 * - approval.task_approved / approval.task_rejected: { tenantId, taskId, chainId, actorId }
 * - approval.routing_failed: { tenantId, evaluationRecordId, reason }
 */
export class ApprovalAuditSubscriber {
  constructor(
    private readonly auditRepo: AuditLogRepositoryPort,
    dispatcher: EventDispatcher<ApprovalEventMap>,
  ) {
    dispatcher.on("ApprovalTaskApproved", async (event) => {
      const ctx: TenantContext = { tenantId: event.tenantId };
      await this.auditRepo.create(ctx, {
        eventType: "approval.task_approved",
        payload: {
          tenantId: event.tenantId,
          taskId: event.taskId,
          chainId: event.chainId,
          actorId: event.actorId,
        },
      });
    });

    dispatcher.on("ApprovalTaskRejected", async (event) => {
      const ctx: TenantContext = { tenantId: event.tenantId };
      await this.auditRepo.create(ctx, {
        eventType: "approval.task_rejected",
        payload: {
          tenantId: event.tenantId,
          taskId: event.taskId,
          chainId: event.chainId,
          actorId: event.actorId,
        },
      });
    });

    dispatcher.on("ApprovalRoutingFailed", async (event) => {
      const ctx: TenantContext = { tenantId: event.tenantId };
      await this.auditRepo.create(ctx, {
        eventType: "approval.routing_failed",
        payload: {
          tenantId: event.tenantId,
          evaluationRecordId: event.evaluationRecordId,
          reason: event.reason,
        },
      });
    });
  }
}
