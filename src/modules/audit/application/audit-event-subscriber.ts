import type { AuditLogRepositoryPort } from "../ports/audit-log-repository.port.js";
import type { PolicyEventMap } from "@/modules/policy/index.js";
import type { EventDispatcher } from "@/shared/event-dispatcher.js";
import type { TenantContext } from "@/modules/directory/index.js";

/**
 * AuditEventSubscriber wires to PolicyEventMap events via EventDispatcher
 * and persists by-reference audit records (D-37).
 *
 * Rollback publications are inferred from DraftCreated events where
 * rollbackFromVersionId is non-null — there is no separate PolicyRolledBack event.
 *
 * Audit payloads include tenantId but never policy content (D-37).
 */
export class AuditEventSubscriber {
  constructor(
    private readonly auditRepo: AuditLogRepositoryPort,
    dispatcher: EventDispatcher<PolicyEventMap>,
  ) {
    dispatcher.on("DraftCreated", async (event) => {
      const ctx: TenantContext = { tenantId: event.tenantId };
      await this.auditRepo.create(ctx, {
        eventType: "policy.draft_created",
        payload: {
          tenantId: event.tenantId,
          policyId: event.policyId,
          policyVersionId: event.policyVersionId,
          versionNumber: event.versionNumber,
          actorId: event.actorId,
          rollbackFromVersionId: event.rollbackFromVersionId,
        },
      });
    });

    dispatcher.on("DraftUpdated", async (event) => {
      const ctx: TenantContext = { tenantId: event.tenantId };
      await this.auditRepo.create(ctx, {
        eventType: "policy.draft_updated",
        payload: {
          tenantId: event.tenantId,
          policyId: event.policyId,
          policyVersionId: event.policyVersionId,
          versionNumber: event.versionNumber,
          actorId: event.actorId,
        },
      });
    });

    dispatcher.on("PolicyPublished", async (event) => {
      const ctx: TenantContext = { tenantId: event.tenantId };
      await this.auditRepo.create(ctx, {
        eventType: "policy.published",
        payload: {
          tenantId: event.tenantId,
          policyId: event.policyId,
          policyVersionId: event.policyVersionId,
          versionNumber: event.versionNumber,
          actorId: event.actorId,
        },
      });
    });
  }
}
