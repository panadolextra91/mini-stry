import type { AuditLog } from "../../domain/audit-log.js";
import type { AuditLogRepositoryPort, CreateAuditLogInput } from "../../ports/audit-log-repository.port.js";
import type { TenantContext } from "@/modules/directory/index.js";
import { auditLogId as buildAuditLogId } from "../../domain/ids.js";

export class InMemoryAuditLogRepository implements AuditLogRepositoryPort {
  private readonly logs = new Map<string, AuditLog>();
  private idCounter = 1;

  async create(ctx: TenantContext, input: CreateAuditLogInput): Promise<AuditLog> {
    const id = buildAuditLogId(`audit_${this.idCounter++}`);
    const log: AuditLog = {
      id,
      tenantId: ctx.tenantId,
      eventType: input.eventType,
      payload: input.payload,
      createdAt: Date.now(),
    };
    this.logs.set(id, log);
    return log;
  }

  async findByTenant(ctx: TenantContext): Promise<AuditLog[]> {
    const result: AuditLog[] = [];
    for (const log of this.logs.values()) {
      if (log.tenantId === ctx.tenantId) {
        result.push(log);
      }
    }
    return result;
  }
}
