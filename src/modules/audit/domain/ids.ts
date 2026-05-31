export type AuditLogId = string & { readonly __brand: "AuditLogId" };
export const auditLogId = (raw: string): AuditLogId => raw as AuditLogId;
