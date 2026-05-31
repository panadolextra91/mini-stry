import type { RoleId } from "../../domain/ids.js";
import type { Role } from "../../domain/role.js";
import type { TenantContext } from "../../application/tenant-context.js";
import type { RoleRepositoryPort } from "../../ports/role-repository.port.js";
import { roleId as buildRoleId } from "../../domain/ids.js";

export class InMemoryRoleRepository implements RoleRepositoryPort {
  private readonly roles = new Map<RoleId, Role>();
  private idCounter = 1;

  async create(ctx: TenantContext, input: { name: string }): Promise<Role> {
    const id = buildRoleId(`role_${this.idCounter++}`);
    const role: Role = {
      id,
      tenantId: ctx.tenantId,
      name: input.name,
      createdAt: Date.now()
    };
    this.roles.set(id, role);
    return role;
  }

  async findById(ctx: TenantContext, id: RoleId): Promise<Role | null> {
    const role = this.roles.get(id);
    if (!role) return null;
    if (role.tenantId !== ctx.tenantId) return null; // Tenant isolation
    return role;
  }

  async findByName(ctx: TenantContext, name: string): Promise<Role | null> {
    for (const role of this.roles.values()) {
      if (role.tenantId === ctx.tenantId && role.name === name) {
        return role;
      }
    }
    return null;
  }

  async listByTenant(ctx: TenantContext): Promise<Role[]> {
    const result: Role[] = [];
    for (const role of this.roles.values()) {
      if (role.tenantId === ctx.tenantId) {
        result.push(role);
      }
    }
    return result;
  }

  async rename(ctx: TenantContext, id: RoleId, newName: string): Promise<Role> {
    const role = await this.findById(ctx, id);
    if (!role) throw new Error("Role not found");
    const updated = { ...role, name: newName };
    this.roles.set(id, updated);
    return updated;
  }

  async delete(ctx: TenantContext, id: RoleId): Promise<void> {
    const role = await this.findById(ctx, id);
    if (role) {
      this.roles.delete(id);
    }
  }
}
