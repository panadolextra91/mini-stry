import type { RoleId } from "../domain/ids.js";
import type { Role } from "../domain/role.js";
import type { TenantContext } from "../application/tenant-context.js";

export interface RoleRepositoryPort {
  create(ctx: TenantContext, input: { name: string }): Promise<Role>;
  findById(ctx: TenantContext, id: RoleId): Promise<Role | null>;
  findByName(ctx: TenantContext, name: string): Promise<Role | null>;
  listByTenant(ctx: TenantContext): Promise<Role[]>;
  rename(ctx: TenantContext, id: RoleId, newName: string): Promise<Role>;
  delete(ctx: TenantContext, id: RoleId): Promise<void>;
}
