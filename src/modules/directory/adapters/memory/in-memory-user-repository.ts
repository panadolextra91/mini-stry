import type { UserId, RoleId } from "../../domain/ids.js";
import type { User } from "../../domain/user.js";
import type { TenantContext } from "../../application/tenant-context.js";
import type { UserRepositoryPort } from "../../ports/user-repository.port.js";
import { userId as buildUserId } from "../../domain/ids.js";

export class InMemoryUserRepository implements UserRepositoryPort {
  private readonly users = new Map<UserId, User>();
  private idCounter = 1;

  async create(ctx: TenantContext, input: { email: string; name: string | null; roleId: RoleId; managerId: UserId | null }): Promise<User> {
    const id = buildUserId(`user_${this.idCounter++}`);
    const user: User = {
      id,
      tenantId: ctx.tenantId,
      email: input.email,
      name: input.name,
      roleId: input.roleId,
      managerId: input.managerId,
      image: null,
      emailVerificationTime: null,
      isAnonymous: null,
      phone: null,
      createdAt: Date.now()
    };
    this.users.set(id, user);
    return user;
  }

  async findById(ctx: TenantContext, id: UserId): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;
    if (user.tenantId !== ctx.tenantId) return null;
    return user;
  }

  async findByEmail(ctx: TenantContext, email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.tenantId === ctx.tenantId && user.email === email) {
        return user;
      }
    }
    return null;
  }

  async listByTenant(ctx: TenantContext): Promise<User[]> {
    const result: User[] = [];
    for (const user of this.users.values()) {
      if (user.tenantId === ctx.tenantId) {
        result.push(user);
      }
    }
    return result;
  }

  async updateProfile(ctx: TenantContext, id: UserId, input: { name: string | null }): Promise<User> {
    const user = await this.findById(ctx, id);
    if (!user) throw new Error("User not found");
    const updated = { ...user, name: input.name };
    this.users.set(id, updated);
    return updated;
  }

  async updateRole(ctx: TenantContext, id: UserId, roleId: RoleId): Promise<User> {
    const user = await this.findById(ctx, id);
    if (!user) throw new Error("User not found");
    const updated = { ...user, roleId };
    this.users.set(id, updated);
    return updated;
  }

  async updateManagerId(ctx: TenantContext, id: UserId, managerId: UserId | null): Promise<User> {
    const user = await this.findById(ctx, id);
    if (!user) throw new Error("User not found");
    const updated = { ...user, managerId };
    this.users.set(id, updated);
    return updated;
  }

  async delete(ctx: TenantContext, id: UserId): Promise<void> {
    const user = await this.findById(ctx, id);
    if (user) {
      this.users.delete(id);
    }
  }
}
