# Phase 1: Tenant & Core Data Model Setup - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the core multi-tenant directory, user profiles, dynamic role structures, reporting supervisors, and basic AuditLog skeleton entities, structured under Modular Monolith + Hexagonal Architecture rules. Persistence is decoupled via clean TypeScript Ports and implemented using a serverless Convex database adapter.

</domain>

<decisions>
## Implementation Decisions

### Domain Neutrality & Decoupled Roles
- **D-01**: The platform must remain 100% domain-neutral. No HR-specific static code, role enums, or HR-only business assumptions are allowed. Leave requests are purely a demonstration workflow.
- **D-02**: Roles are completely data-driven (data, not code). We will implement a `RoleEntity` representing tenant-defined roles (e.g. Receptionist, Monk, CEO). The `UserEntity` role property dynamically refers to a registered role string rather than a static TypeScript enum.
- **D-03**: Support dynamic role registering in the database, allowing each organization (tenant) to declare a custom hierarchy.

### Supervisor Reporting Structure
- **D-04**: Direct manager/reporting supervisor relations are tracked dynamically using a simple `managerId` field pointing to another User ID within the same Tenant, representing a generic tree structure.

### Audit Log Foundation
- **D-05**: Introduce a basic `AuditLogEntity` domain skeleton in Phase 1 to lay the foundation for policy governance, publication tracking, and approval histories (no service implementation needed yet).

### Modular Monolith & Hexagonal Folder Structure
- **D-06**: Enforce strict Hexagonal Architecture structure:
  ```
  convex/
    schema.ts             <- Convex database schema definition
    users.ts              <- Convex RPC endpoints (acting as adapters)
    tenants.ts
  src/
    modules/
      tenant/
        domain/
          entities.ts     <- Pure TS (Tenant, User, Role, AuditLog entities)
          types.ts
        ports/
          tenant.repository.port.ts <- TS Interfaces
          user.repository.port.ts
          role.repository.port.ts
        application/
          tenant.service.ts  <- Orchestrates tenant operations
          user.service.ts    <- Handles dynamic role assignments and registration
        adapters/
          database/
            convex-tenant.repository.ts <- Implements port using Convex DB
            convex-user.repository.ts
            convex-role.repository.ts
  ```

### the agent's Discretion
- Exact method signatures in Port interfaces.
- Testing mock configurations and Vitest boilerplate setup.
- Helper scripts for bootstrapping database fields.

</decisions>

<specifics>
## Specific Ideas

- Domain layer is 100% Pure TS, not importing from any Convex library, guaranteeing database independence.
- Roles can be absolutely anything (Receptionist, Monk, CEO, Supervisor). The DSL evaluator in Phase 2 will dynamically match these role strings against matching rules (e.g., `approve_by: supervisor`).

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
- This is Phase 1; all subsequent modules (DSL compiler, policy versioner, request evaluator) will import and build upon the tenant, user, dynamic role, and audit log domain models created here.

</code_context>

<deferred>
## Deferred Ideas

- Full AuditLog persistence flow — Phase 6. Only the domain entity is created in Phase 1.

</deferred>

---

*Phase: 01-tenant-core-setup*
*Context gathered: 2026-05-31*
