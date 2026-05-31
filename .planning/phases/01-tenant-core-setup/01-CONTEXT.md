# Phase 1: Tenant & Core Data Model Setup - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the core multi-tenant directory, user profiles, reporting structures, and database schema using Hexagonal Architecture (Modular Monolith style). Decouple using Repository Ports and write Convex database adapters.

</domain>

<decisions>
## Implementation Decisions

### Database & ORM
- **D-01**: Build all core business modules with Pure TS domain logic and strict Port interfaces. Implement persistence using a Convex Adapter, keeping Convex dependency isolated inside adapters/database layer.
- **D-02**: Convex RPC entry points act as adapters/http (or adapters/rpc) layer, passing requests to application services and returning results.

### Multi-Tenancy Isolation
- **D-03**: Single database instance with logical data separation using a `tenantId` field present on all Convex database documents.

### Reporting Lines Hierarchy
- **D-04**: Track reporting hierarchy by having a simple `managerId` field directly on the User entity pointing to another User in the same Tenant.
- **D-05**: User Roles are defined as a static TS enum: `employee`, `manager`, `hr_head`, `ceo`.

### Hexagonal Folder Structure
- **D-06**: Restructure codebase matching:
  ```
  convex/
    schema.ts             <- Convex database schema definition
    users.ts              <- Convex RPC endpoints (acting as adapters)
    tenants.ts
  src/
    modules/
      tenant/
        domain/
          entities.ts     <- Pure TS (Tenant, User, Role entities)
          types.ts
        ports/
          tenant.repository.port.ts <- TS Interfaces
          user.repository.port.ts
        application/
          tenant.service.ts  <- Orchestrates tenant operations
          user.service.ts
        adapters/
          database/
            convex-tenant.repository.ts <- Implements port using Convex DB
            convex-user.repository.ts
  ```

### the agent's Discretion
- Exact method signatures in Port interfaces.
- Testing mock configurations and Vitest boilerplate setup.
- Helper scripts for bootstrapping database fields.

</decisions>

<specifics>
## Specific Ideas

- Domain layer is 100% Pure TS, not importing from any Convex library, guaranteeing database independence.
- Convex entry points are thin wrappers that decode inputs, fetch dependencies, delegate to Application services, and handle runtime exceptions.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Vision & Specifications
- `docs/idea.md` — Multi-tenant policy engine concept, core models, stack, constraints, and 2-week MVP roadmap.
- `docs/engineering.md` — Strict testing rules (100% engine coverage, 90%+ critical logic), architecture isolation boundaries, and strict TS code quality guidelines.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None (Greenfield codebase).

### Established Patterns
- Absolute Modular Monolith + Ports & Adapters pattern established in `EXECUTE_RULE.MD`.

### Integration Points
- This is Phase 1; all subsequent phases will import and build upon the tenant/user domain models and repository ports created here.

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-tenant-core-setup*
*Context gathered: 2026-05-31*
