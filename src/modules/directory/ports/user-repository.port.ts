import type { UserId, RoleId } from "../domain/ids.js";
import type { User } from "../domain/user.js";
import type { TenantContext } from "../application/tenant-context.js";

export interface UserRepositoryPort {
  create(
    ctx: TenantContext,
    input: { email: string; name: string | null; roleId: RoleId; managerId: UserId | null },
  ): Promise<User>;
  findById(ctx: TenantContext, id: UserId): Promise<User | null>;
  findByEmail(ctx: TenantContext, email: string): Promise<User | null>;
  listByTenant(ctx: TenantContext): Promise<User[]>;
  updateProfile(ctx: TenantContext, id: UserId, input: { name: string | null }): Promise<User>;
  updateRole(ctx: TenantContext, id: UserId, roleId: RoleId): Promise<User>;
  updateManagerId(ctx: TenantContext, id: UserId, managerId: UserId | null): Promise<User>;
  delete(ctx: TenantContext, id: UserId): Promise<void>;
}
