import type { RoleId } from "../domain/ids.js";
import type { Role } from "../domain/role.js";
import type { TenantContext } from "./tenant-context.js";
import type { RoleRepositoryPort } from "../ports/role-repository.port.js";
import { RoleNameAlreadyExistsError, RoleNotFoundError } from "./errors.js";

export class RoleService {
  constructor(private readonly roleRepo: RoleRepositoryPort) {}

  async createRole(ctx: TenantContext, input: { name: string }): Promise<Role> {
    const existing = await this.roleRepo.findByName(ctx, input.name);
    if (existing) {
      throw new RoleNameAlreadyExistsError(input.name);
    }
    return this.roleRepo.create(ctx, input);
  }

  async findRoleById(ctx: TenantContext, id: RoleId): Promise<Role | null> {
    return this.roleRepo.findById(ctx, id);
  }

  async findRoleByName(ctx: TenantContext, name: string): Promise<Role | null> {
    return this.roleRepo.findByName(ctx, name);
  }

  async listRolesByTenant(ctx: TenantContext): Promise<Role[]> {
    return this.roleRepo.listByTenant(ctx);
  }

  async renameRole(ctx: TenantContext, id: RoleId, newName: string): Promise<Role> {
    const role = await this.roleRepo.findById(ctx, id);
    if (!role) {
      throw new RoleNotFoundError(id);
    }
    const existing = await this.roleRepo.findByName(ctx, newName);
    if (existing) {
      throw new RoleNameAlreadyExistsError(newName);
    }
    return this.roleRepo.rename(ctx, id, newName);
  }

  async deleteRole(ctx: TenantContext, id: RoleId): Promise<void> {
    const role = await this.roleRepo.findById(ctx, id);
    if (!role) {
      throw new RoleNotFoundError(id);
    }
    return this.roleRepo.delete(ctx, id);
  }
}
