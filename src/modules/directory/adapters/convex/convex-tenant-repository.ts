import type { TenantId } from "../../domain/ids.js";
import type { Tenant } from "../../domain/tenant.js";
import type { TenantRepositoryPort } from "../../ports/tenant-repository.port.js";
import type { MutationCtx } from "../../../../../convex/_generated/server.js";
import { fromTenantId, tenantDocToEntity } from "./mappers.js";

export class ConvexTenantRepository implements TenantRepositoryPort {
  constructor(private readonly db: MutationCtx["db"]) {}

  async create(input: { name: string }): Promise<Tenant> {
    const id = await this.db.insert("tenants", {
      name: input.name,
      createdAt: Date.now(),
    });
    const doc = await this.db.get(id);
    if (!doc) throw new Error("Tenant creation failed");
    return tenantDocToEntity(doc);
  }

  async findById(id: TenantId): Promise<Tenant | null> {
    const doc = await this.db.get(fromTenantId(id));
    if (!doc) return null;
    return tenantDocToEntity(doc);
  }
}
