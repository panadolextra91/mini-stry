import type { AuditLog } from "../domain/audit-log.js";
import type { TenantContext } from "@/modules/directory/index.js";

export interface CreateAuditLogInput {
  readonly eventType: string;
  readonly payload: unknown;
}

export interface AuditLogRepositoryPort {
  create(ctx: TenantContext, input: CreateAuditLogInput): Promise<AuditLog>;
  findByTenant(ctx: TenantContext): Promise<AuditLog[]>;
}
