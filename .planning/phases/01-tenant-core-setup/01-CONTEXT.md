# Phase 1: Tenant & Core Data Model Setup - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the core multi-tenant directory, Tenant, User (linked via stable `roleId`), dynamic Role, foundational AuditLog, Policy, and PolicyVersion domain skeletons, structured under Modular Monolith + Hexagonal Architecture rules. Persistence is decoupled via clean TypeScript Ports and implemented using a serverless Convex database adapter.

</domain>

<decisions>
## Implementation Decisions

### Domain Neutrality & stable ID-based Roles
- **D-01**: The platform must remain 100% domain-neutral. No HR-specific static code, role enums, or HR-only business assumptions are allowed. Leave requests are purely a demonstration workflow.
- **D-02**: Roles are completely data-driven (data, not code). A `RoleEntity` represents tenant-defined roles (e.g. Receptionist, Monk, CEO).
- **D-03**: Users are linked to dynamic roles via a stable identifier **`roleId`** referencing the `RoleEntity.id` (not the name string) to ensure references remain consistent if a role is renamed.

### Single Responsibility Service Layers
- **D-04**: Separate role management and user management into distinct, highly focused application services to enforce single responsibility:
  - **`RoleService`**: handles registering roles, renaming roles, and listing roles.
  - **`UserService`**: handles user registration, role assignment, and supervisor reporting lines.

### Policy Domain Skeletons
- **D-05**: Place lightweight **`PolicyEntity`** and **`PolicyVersionEntity`** skeletons in the core domain in Phase 1 (no schemas, persistence, or services yet). This establishes policies as first-class citizens early and prevents future breaking refactors.

### Supervisor Reporting Structure
- **D-06**: Direct manager/reporting supervisor relations are tracked dynamically using a simple `managerId` field pointing to another User ID within the same Tenant, representing a generic tree structure.

### Audit Log Foundation
- **D-07**: Introduce a basic `AuditLogEntity` domain skeleton in Phase 1 to lay the foundation for policy governance, publication tracking, and approval histories (no service implementation needed yet).

### Modular Monolith & Hexagonal Folder Structure
- Enforce strict Hexagonal Architecture structure:
  ```
  convex/
    schema.ts             <- Convex database schema definition
    users.ts              <- Convex RPC endpoints (acting as adapters)
    roles.ts
    tenants.ts
  src/
    modules/
      tenant/
        domain/
          entities.ts     <- Tenant, User, Role, Policy, PolicyVersion, AuditLog
          types.ts
        ports/
          tenant.repository.port.ts
          role.repository.port.ts
          user.repository.port.ts
        application/
          tenant.service.ts
          role.service.ts    <- RoleService (registerRole, renameRole, listRoles)
          user.service.ts    <- UserService (registerUser, assignRole, reporting lines)
          dtos.ts
        adapters/
          database/
            convex-tenant.repository.ts
            convex-role.repository.ts
            convex-user.repository.ts
  ```

### the agent's Discretion
- Exact method signatures in Port interfaces.
- Testing mock configurations and Vitest boilerplate setup.

</decisions>

<specifics>
## Specific Ideas

- Domain layer is 100% Pure TS, not importing from any Convex library, guaranteeing database independence.
- Roles can be absolutely anything (Receptionist, Monk, CEO, Supervisor). The DSL evaluator in Phase 2 will dynamically match role references by looking up user's `roleId` and mapping it to role names at runtime.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Vision & Specifications
- `docs/idea.md` — Multi-tenant policy engine concept, core models, stack, constraints, and 2-week MVP roadmap.
- `docs/engineering.md` — Quality philosophies, strict testing coverage targets (100% engine coverage, 90%+ critical logic), and architectural bounds.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None (Greenfield codebase).

### Established Patterns
- Absolute Modular Monolith + Ports & Adapters pattern established in `EXECUTE_RULE.MD`.

### Integration Points
- This is Phase 1; all subsequent modules (DSL compiler, policy versioner, request evaluator) will import and build upon the tenant, user, dynamic role, policy, and audit log domain models created here.

</code_context>

<deferred>
## Deferred Ideas

- Full AuditLog persistence flow — Phase 6. Only the domain entity is created in Phase 1.
- Policy & PolicyVersion persistence and service layer — Phase 3. Only domain skeletons exist in Phase 1.

</deferred>

---

*Phase: 01-tenant-core-setup*
*Context gathered: 2026-05-31*
