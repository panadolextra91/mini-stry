import type { TenantId } from "@/modules/directory/index.js";
import type { AuditLogId } from "./ids.js";

export interface AuditLog {
  readonly id: AuditLogId;
  readonly tenantId: TenantId;
  /**
   * Open string per D-16. Convention: `<aggregate>.<action>` (e.g. `role.created`, `user.created`, `policy.published`).
   * Originating modules own their event constants; the audit module is a storage mechanism, not a registry.
   */
  readonly eventType: string; // OPEN per D-16, convention "<aggregate>.<action>"
  readonly payload: unknown;
  readonly createdAt: number; // epoch ms
}
