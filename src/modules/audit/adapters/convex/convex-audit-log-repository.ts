import type { AuditLog } from "../../domain/audit-log.js";
import type { AuditLogRepositoryPort, CreateAuditLogInput } from "../../ports/audit-log-repository.port.js";
import type { TenantContext } from "@/modules/directory/index.js";
import type { MutationCtx, QueryCtx } from "../../../../../convex/_generated/server.js";
import { fromTenantId } from "@/modules/directory/adapters/convex/mappers.js";
import { toAuditLogDomain } from "./mappers.js";

export class ConvexAuditLogRepository implements AuditLogRepositoryPort {
  constructor(private readonly db: MutationCtx["db"] | QueryCtx["db"]) {}

  async create(ctx: TenantContext, input: CreateAuditLogInput): Promise<AuditLog> {
    if (!('insert' in this.db)) throw new Error("Mutations require MutationCtx");
    const id = await this.db.insert("auditLogs", {
      tenantId: fromTenantId(ctx.tenantId),
      eventType: input.eventType,
      payload: input.payload,
      createdAt: Date.now(),
    });
    const doc = await this.db.get(id);
    if (!doc) throw new Error("AuditLog creation failed");
    return toAuditLogDomain(doc);
  }

  async findByTenant(ctx: TenantContext): Promise<AuditLog[]> {
    const docs = await this.db.query("auditLogs")
      .withIndex("by_tenant_created", (q) =>
        q.eq("tenantId", fromTenantId(ctx.tenantId)),
      )
      .collect();
    return docs.map(toAuditLogDomain);
  }
}
