import type { AuditLogRepositoryPort } from "../ports/audit-log-repository.port.js";
import type { RequestEventMap } from "@/modules/request/index.js";
import type { EventDispatcher } from "@/shared/event-dispatcher.js";
import type { TenantContext } from "@/modules/directory/index.js";

/**
 * RequestAuditSubscriber wires to RequestEventMap events via EventDispatcher
 * and persists by-reference audit records (D-37).
 *
 * Audit payloads carry only IDs/metadata (evaluationRecordId, requestType, reason, errorCode)
 * — never requestInput, decision, or trace content (D-37).
 */
export class RequestAuditSubscriber {
  constructor(
    private readonly auditRepo: AuditLogRepositoryPort,
    dispatcher: EventDispatcher<RequestEventMap>,
  ) {
    dispatcher.on("RequestEvaluated", async (event) => {
      const ctx: TenantContext = { tenantId: event.tenantId };
      await this.auditRepo.create(ctx, {
        eventType: "request.evaluated",
        payload: {
          tenantId: event.tenantId,
          evaluationRecordId: event.evaluationRecordId,
        },
      });
    });

    dispatcher.on("EvaluationFailed", async (event) => {
      const ctx: TenantContext = { tenantId: event.tenantId };
      await this.auditRepo.create(ctx, {
        eventType: "request.evaluation_failed",
        payload: {
          tenantId: event.tenantId,
          evaluationRecordId: event.evaluationRecordId,
          errorCode: event.errorCode,
        },
      });
    });

    dispatcher.on("ResolutionFailed", async (event) => {
      const ctx: TenantContext = { tenantId: event.tenantId };
      await this.auditRepo.create(ctx, {
        eventType: "request.resolution_failed",
        payload: {
          tenantId: event.tenantId,
          requestType: event.requestType,
          reason: event.reason,
        },
      });
    });
  }
}
