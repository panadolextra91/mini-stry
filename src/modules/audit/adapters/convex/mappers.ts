import { auditLogId as buildAuditLogId, type AuditLogId } from "../../domain/ids.js";
import type { AuditLog } from "../../domain/audit-log.js";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel.js";
import { toTenantId } from "@/modules/directory/adapters/convex/mappers.js";

export const toAuditLogId = (raw: Id<"auditLogs">): AuditLogId => buildAuditLogId(raw);
export const fromAuditLogId = (brand: AuditLogId): Id<"auditLogs"> =>
  brand as string as Id<"auditLogs">;

export const toAuditLogDomain = (doc: Doc<"auditLogs">): AuditLog => ({
  id: toAuditLogId(doc._id),
  tenantId: toTenantId(doc.tenantId),
  eventType: doc.eventType,
  payload: doc.payload,
  createdAt: doc.createdAt,
});
