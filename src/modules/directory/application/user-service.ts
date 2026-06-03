import type { UserId, RoleId } from "../domain/ids.js";
import type { User } from "../domain/user.js";
import type { TenantContext } from "./tenant-context.js";
import type { UserRepositoryPort } from "../ports/user-repository.port.js";
import type { RoleRepositoryPort } from "../ports/role-repository.port.js";
import {
  EmailAlreadyExistsError,
  RoleNotFoundError,
  UserNotFoundError,
  ManagerNotFoundError,
  ManagerCycleError,
} from "./errors.js";

const MAX_MANAGER_CHAIN_DEPTH = 50;

export class UserService {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly roleRepo: RoleRepositoryPort,
  ) {}

  async createUser(
    ctx: TenantContext,
    input: { email: string; name: string | null; roleId: RoleId; managerId: UserId | null },
  ): Promise<User> {
    const existingEmail = await this.userRepo.findByEmail(ctx, input.email);
    if (existingEmail) {
      throw new EmailAlreadyExistsError(input.email);
    }

    const role = await this.roleRepo.findById(ctx, input.roleId);
    if (!role) {
      throw new RoleNotFoundError(input.roleId);
    }

    if (input.managerId) {
      const manager = await this.userRepo.findById(ctx, input.managerId);
      if (!manager) {
        throw new ManagerNotFoundError(input.managerId);
      }
    }

    return this.userRepo.create(ctx, input);
  }

  async findUserById(ctx: TenantContext, id: UserId): Promise<User | null> {
    return this.userRepo.findById(ctx, id);
  }

  async findUserByEmail(ctx: TenantContext, email: string): Promise<User | null> {
    return this.userRepo.findByEmail(ctx, email);
  }

  async listUsersByTenant(ctx: TenantContext): Promise<User[]> {
    return this.userRepo.listByTenant(ctx);
  }

  async updateUserProfile(
    ctx: TenantContext,
    id: UserId,
    input: { name: string | null },
  ): Promise<User> {
    const user = await this.userRepo.findById(ctx, id);
    if (!user) {
      throw new UserNotFoundError(id);
    }
    return this.userRepo.updateProfile(ctx, id, input);
  }

  async assignRole(ctx: TenantContext, id: UserId, roleId: RoleId): Promise<User> {
    const user = await this.userRepo.findById(ctx, id);
    if (!user) {
      throw new UserNotFoundError(id);
    }
    const role = await this.roleRepo.findById(ctx, roleId);
    if (!role) {
      throw new RoleNotFoundError(roleId);
    }
    return this.userRepo.updateRole(ctx, id, roleId);
  }

  async setManager(ctx: TenantContext, id: UserId, managerId: UserId | null): Promise<User> {
    const user = await this.userRepo.findById(ctx, id);
    if (!user) {
      throw new UserNotFoundError(id);
    }

    if (managerId === null) {
      return this.userRepo.updateManagerId(ctx, id, null);
    }

    if (id === managerId) {
      throw new ManagerCycleError(id, managerId);
    }

    const newManager = await this.userRepo.findById(ctx, managerId);
    if (!newManager) {
      throw new ManagerNotFoundError(managerId);
    }

    let currentCursorId: UserId | null = newManager.managerId;
    let depth = 0;

    while (currentCursorId) {
      if (currentCursorId === id) {
        throw new ManagerCycleError(id, managerId);
      }

      if (depth >= MAX_MANAGER_CHAIN_DEPTH) {
        throw new Error(
          `Assigning ${managerId} as manager of ${id} exceeds maximum chain depth of ${MAX_MANAGER_CHAIN_DEPTH} (data corruption protection)`,
        );
      }

      const cursorUser = await this.userRepo.findById(ctx, currentCursorId);
      if (!cursorUser) {
        break;
      }

      currentCursorId = cursorUser.managerId;
      depth++;
    }

    return this.userRepo.updateManagerId(ctx, id, managerId);
  }

  async deleteUser(ctx: TenantContext, id: UserId): Promise<void> {
    const user = await this.userRepo.findById(ctx, id);
    if (!user) {
      throw new UserNotFoundError(id);
    }
    return this.userRepo.delete(ctx, id);
  }
}
