// Domain entities
export type { Tenant } from "./domain/tenant.js";
export type { User } from "./domain/user.js";
export type { Role } from "./domain/role.js";
// Branded IDs + factories
export type { TenantId, UserId, RoleId } from "./domain/ids.js";
export { tenantId, userId, roleId } from "./domain/ids.js";
// TenantContext (D-19)
export type { TenantContext } from "./application/tenant-context.js";
export { tenantContext } from "./application/tenant-context.js";
// Repository ports
export type { TenantRepositoryPort } from "./ports/tenant-repository.port.js";
export type { UserRepositoryPort } from "./ports/user-repository.port.js";
export type { RoleRepositoryPort } from "./ports/role-repository.port.js";
// Errors
export {
  RoleNameAlreadyExistsError,
  EmailAlreadyExistsError,
  RoleNotFoundError,
  UserNotFoundError,
  ManagerNotFoundError,
  ManagerCycleError,
} from "./application/errors.js";
// Services
export { RoleService } from "./application/role-service.js";
export { UserService } from "./application/user-service.js";
