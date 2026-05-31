# Module: directory

## Public API
- **Entities**: Tenant, User, Role
- **Branded IDs**: TenantId, UserId, RoleId (and factories)
- **TenantContext**: TenantContext interface and factory
- **Ports**: TenantRepositoryPort, UserRepositoryPort, RoleRepositoryPort
- **Errors**: RoleNameAlreadyExistsError, EmailAlreadyExistsError, RoleNotFoundError, UserNotFoundError, ManagerNotFoundError, ManagerCycleError

## Bounded context
Tenant, User, and Role are entities INSIDE this bounded context, not separate modules.

## Module Boundary Rule
"Cross-module imports are ALLOWED. Cross-module coupling is NOT."

Forbidden pattern (deep import):
`import { RoleService } from "@/modules/directory/application/role-service"`

Allowed pattern (barrel import):
`import { RoleService } from "@/modules/directory"`

## TenantContext
Every service method takes `ctx` as the first parameter. Ambient contexts are banned.

## Domain layer rules
- Domain interfaces are state-only (D-13).
- Domain layer does NOT import from `convex/_generated/*` (D-14).
