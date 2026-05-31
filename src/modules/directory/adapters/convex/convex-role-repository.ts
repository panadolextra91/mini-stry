import type { RoleId } from "../../domain/ids.js";
import type { Role } from "../../domain/role.js";
import type { TenantContext } from "../../application/tenant-context.js";
import type { RoleRepositoryPort } from "../../ports/role-repository.port.js";
import type { MutationCtx, QueryCtx } from "../../../../../convex/_generated/server.js";
import { fromTenantId, fromRoleId, roleDocToEntity } from "./mappers.js";

export class ConvexRoleRepository implements RoleRepositoryPort {
  constructor(private readonly db: MutationCtx["db"] | QueryCtx["db"]) {}

  async create(ctx: TenantContext, input: { name: string }): Promise<Role> {
    if (!('insert' in this.db)) throw new Error("Mutations require MutationCtx");
    const id = await this.db.insert("roles", {
      tenantId: fromTenantId(ctx.tenantId),
      name: input.name,
      createdAt: Date.now(),
    });
    const doc = await this.db.get(id);
    if (!doc) throw new Error("Role creation failed");
    return roleDocToEntity(doc);
  }

  async findById(ctx: TenantContext, id: RoleId): Promise<Role | null> {
    const doc = await this.db.get(fromRoleId(id));
    if (!doc) return null;
    if (doc.tenantId !== fromTenantId(ctx.tenantId)) return null;
    return roleDocToEntity(doc);
  }

  async findByName(ctx: TenantContext, name: string): Promise<Role | null> {
    const doc = await this.db.query("roles")
      .withIndex("by_tenant_name", q => q.eq("tenantId", fromTenantId(ctx.tenantId)).eq("name", name))
      .unique();
    return doc ? roleDocToEntity(doc) : null;
  }

  async listByTenant(ctx: TenantContext): Promise<Role[]> {
    const docs = await this.db.query("roles")
      .withIndex("by_tenant_name", q => q.eq("tenantId", fromTenantId(ctx.tenantId)))
      .collect();
    return docs.map(roleDocToEntity);
  }

  async rename(ctx: TenantContext, id: RoleId, newName: string): Promise<Role> {
    if (!('patch' in this.db)) throw new Error("Mutations require MutationCtx");
    const existing = await this.db.get(fromRoleId(id));
    if (!existing || existing.tenantId !== fromTenantId(ctx.tenantId)) {
      throw new Error(`Role ${id} not found in tenant ${ctx.tenantId}`);
    }
    await this.db.patch(fromRoleId(id), { name: newName });
    const doc = await this.db.get(fromRoleId(id));
    if (!doc) throw new Error("Role update failed");
    return roleDocToEntity(doc);
  }

  async delete(ctx: TenantContext, id: RoleId): Promise<void> {
    if (!('delete' in this.db)) throw new Error("Mutations require MutationCtx");
    const existing = await this.db.get(fromRoleId(id));
    if (!existing || existing.tenantId !== fromTenantId(ctx.tenantId)) {
      throw new Error(`Role ${id} not found in tenant ${ctx.tenantId}`);
    }
    await this.db.delete(fromRoleId(id));
  }
}
