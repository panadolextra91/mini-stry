import type { UserId, RoleId } from "../../domain/ids.js";
import type { User } from "../../domain/user.js";
import type { TenantContext } from "../../application/tenant-context.js";
import type { UserRepositoryPort } from "../../ports/user-repository.port.js";
import type { MutationCtx, QueryCtx } from "../../../../../convex/_generated/server.js";
import { fromTenantId, fromUserId, fromRoleId, userDocToEntity } from "./mappers.js";

export class ConvexUserRepository implements UserRepositoryPort {
  constructor(private readonly db: MutationCtx["db"] | QueryCtx["db"]) {}

  async create(
    ctx: TenantContext,
    input: { email: string; name: string | null; roleId: RoleId; managerId: UserId | null },
  ): Promise<User> {
    if (!("insert" in this.db)) throw new Error("Mutations require MutationCtx");
    const id = await this.db.insert("users", {
      tenantId: fromTenantId(ctx.tenantId),
      email: input.email,
      ...(input.name !== null && { name: input.name }),
      roleId: fromRoleId(input.roleId),
      managerId: input.managerId ? fromUserId(input.managerId) : null,
      createdAt: Date.now(),
    });
    const doc = await this.db.get(id);
    if (!doc) throw new Error("User creation failed");
    return userDocToEntity(doc);
  }

  async findById(ctx: TenantContext, id: UserId): Promise<User | null> {
    const doc = await this.db.get(fromUserId(id));
    if (!doc) return null;
    if (doc.tenantId !== fromTenantId(ctx.tenantId)) return null;
    return userDocToEntity(doc);
  }

  async findByEmail(ctx: TenantContext, email: string): Promise<User | null> {
    const doc = await this.db
      .query("users")
      .withIndex("by_tenant_email", (q) =>
        q.eq("tenantId", fromTenantId(ctx.tenantId)).eq("email", email),
      )
      .unique();
    return doc ? userDocToEntity(doc) : null;
  }

  async listByTenant(ctx: TenantContext): Promise<User[]> {
    const docs = await this.db
      .query("users")
      .withIndex("by_tenant_email", (q) => q.eq("tenantId", fromTenantId(ctx.tenantId)))
      .collect();
    return docs.map(userDocToEntity);
  }

  async updateProfile(
    ctx: TenantContext,
    id: UserId,
    input: { name: string | null },
  ): Promise<User> {
    if (!("patch" in this.db)) throw new Error("Mutations require MutationCtx");
    const existing = await this.db.get(fromUserId(id));
    if (!existing || existing.tenantId !== fromTenantId(ctx.tenantId)) {
      throw new Error(`User ${id} not found in tenant ${ctx.tenantId}`);
    }
    await this.db.patch(fromUserId(id), input.name !== null ? { name: input.name } : {});
    const doc = await this.db.get(fromUserId(id));
    if (!doc) throw new Error("User update failed");
    return userDocToEntity(doc);
  }

  async updateRole(ctx: TenantContext, id: UserId, roleId: RoleId): Promise<User> {
    if (!("patch" in this.db)) throw new Error("Mutations require MutationCtx");
    const existing = await this.db.get(fromUserId(id));
    if (!existing || existing.tenantId !== fromTenantId(ctx.tenantId)) {
      throw new Error(`User ${id} not found in tenant ${ctx.tenantId}`);
    }
    await this.db.patch(fromUserId(id), { roleId: fromRoleId(roleId) });
    const doc = await this.db.get(fromUserId(id));
    if (!doc) throw new Error("User update failed");
    return userDocToEntity(doc);
  }

  async updateManagerId(ctx: TenantContext, id: UserId, managerId: UserId | null): Promise<User> {
    if (!("patch" in this.db)) throw new Error("Mutations require MutationCtx");
    const existing = await this.db.get(fromUserId(id));
    if (!existing || existing.tenantId !== fromTenantId(ctx.tenantId)) {
      throw new Error(`User ${id} not found in tenant ${ctx.tenantId}`);
    }
    await this.db.patch(fromUserId(id), { managerId: managerId ? fromUserId(managerId) : null });
    const doc = await this.db.get(fromUserId(id));
    if (!doc) throw new Error("User update failed");
    return userDocToEntity(doc);
  }

  async delete(ctx: TenantContext, id: UserId): Promise<void> {
    if (!("delete" in this.db)) throw new Error("Mutations require MutationCtx");
    const existing = await this.db.get(fromUserId(id));
    if (!existing || existing.tenantId !== fromTenantId(ctx.tenantId)) {
      throw new Error(`User ${id} not found in tenant ${ctx.tenantId}`);
    }
    await this.db.delete(fromUserId(id));
  }
}
