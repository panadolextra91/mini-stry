# Phase 1: Core Platform Foundations — Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 bootstraps the **structural foundation** of the Policy Runtime Platform: directory layout, Convex schemas with strict multi-tenant isolation, Pure-TS domain entity interfaces, and the two application services that own tenant directory administration (`RoleService`, `UserService`). It establishes persistence **skeletons** for `Policy`, `PolicyVersion`, and `AuditLog` — entities exist in the database, but their content/behavior is deferred to later phases.

**Phase 1 IS:**

- Modular directory under `src/modules/{directory, policy, audit}/{domain, application, ports, adapters}/`
- Convex schemas: `tenants`, `users`, `roles`, `policies`, `policyVersions`, `auditLogs` (skeleton fields)
- Pure-TS domain interfaces + branded ID types per module
- `RoleService` and `UserService` with constructor-injected repository ports
- `TenantContext` first-class object
- Vitest suites for service business logic with in-memory repo fakes

**Phase 1 IS NOT:**

- JSON Schema validation (Phase 2, runtime)
- Condition evaluator / `EvaluationContext` interface (Phase 2)
- Decision emitter (Phase 2)
- Policy lifecycle (draft/publish/immutability/rollback) (Phase 3)
- Approval routing or any Decision Consumer (Phase 5)
- React portal / Monaco editor (Phase 6)
- The `runtime/` and `decision/` modules — created lazily by Phase 2+

**Requirements delivered:** CON-01, CON-02, CON-03, CON-04, POL-05, POL-06, AUD-03

</domain>

<decisions>
## Implementation Decisions

### Directory Layout

- **Module-first by Concept Hierarchy.** Modules follow the architectural hierarchy from PROJECT.md, NOT entity granularity:

  ```
  src/modules/
    directory/    ← Tenant, User, Role (bounded context)
    policy/       ← Policy, PolicyVersion (skeleton at Phase 1)
    runtime/      ← deferred to Phase 2
    decision/     ← deferred to Phase 2+
    audit/        ← AuditLog (skeleton at Phase 1)
  ```

  Tenant/User/Role are entities INSIDE the `directory` bounded context, not separate modules. Phase 1 creates only `directory/`, `policy/`, `audit/`.

- **Each module shape:** `{domain, application, ports, adapters, index.ts, README.md}`. `index.ts` is the barrel public API; `README.md` documents public exports and warns against internal imports.

- **convex/ HARD RULE — locked for all phases:**
  - convex/ **MAY**: validate input shape · instantiate dependencies · call application services · map responses
  - convex/ **MAY NOT**: evaluate policies · enforce business rules · perform approval routing · contain domain logic

- **Module Boundary Rule (D-08):** _"Cross-module imports are ALLOWED. Cross-module coupling is NOT."_
  - Allowed: `runtime → @/modules/policy` (through `index.ts`)
  - Forbidden: `runtime → @/modules/policy/application/*` (deep import — "chui cửa sổ")
  - Enforced by: ESLint `import/no-restricted-paths` + mandatory per-module barrel `index.ts` + mandatory per-module `README.md`

- **Repo shape:** Single package — one `package.json`, one `tsconfig.json`. No pnpm workspaces (MVP).

### Tenant Isolation & Schema (Convex)

- **D-09 — Logical Tenant Isolation:**
  - `tenantId: Id<'tenants'>` on every tenant-owned entity
  - All repository methods are tenant-scoped
  - All indexes start with `tenantId` as the first key
  - All queries require `tenantId` filtering
  - No cross-tenant query APIs are exposed
  - Tenant is treated as a **security and ownership boundary**, not merely a data attribute

- **D-10 — Role Registry:**
  - Roles are tenant-owned data
  - Role names are unique only within a tenant (`[tenantId, name]` composite unique index on `roles`)
  - Users reference roles through `roleId` (stable, ID-based — CON-03)
  - Role names are mutable display attributes; role identity is stable

- **D-11 — managerId & Cycle Prevention:**
  - Users may optionally reference another user in the same tenant through `managerId`
  - `managerId` is nullable; `null` indicates a root actor with no manager
  - **Cycle prevention is enforced in the application layer through `UserService`** (not at schema)
  - Validation rules: manager must exist · manager must belong to same tenant · assignment must not introduce cycles
  - Repository and schema layers remain persistence-only and do not enforce hierarchy rules
  - Org hierarchy is intentionally modeled as a simple self-reference for MVP simplicity

- **D-12 — Phase 1 Skeleton Tables:**
  - Phase 1 introduces persistence skeletons for `Policy`, `PolicyVersion`, `AuditLog`
  - `PolicyVersion` includes a `content` field, but **the content structure is intentionally undefined at Phase 1**
  - Runtime-owned content schema validation is deferred to Phase 2
  - This separates **storage shape (Phase 1)** from **content shape (Phase 2 runtime)**

### Entity Shape & ID Typing

- **D-13 — Domain Entities = Plain TS Interfaces:**
  - Entities represent state only
  - Business workflows and invariants are implemented in application services
  - Class-based aggregates are deferred until a concrete domain behavior requires them
  - Avoid ceremonial OOP. Prefer simple, serializable data structures that map cleanly to Convex documents

- **D-14 — Branded String IDs:**
  - All domain identifiers use branded string types (e.g., `type TenantId = string & { readonly __brand: 'TenantId' }`)
  - The domain layer remains storage-agnostic and **does NOT import Convex-specific `Id<>` types**
  - Infrastructure adapters are responsible for mapping between Convex `Id<>` values and branded domain identifiers at the boundary
  - Branded IDs provide compile-time safety while preserving simple serialization

- **D-15 — Identifier Ownership:**
  - Each module owns the identifier types of the entities it defines (`directory` owns TenantId/UserId/RoleId; `policy` owns PolicyId/PolicyVersionId; `audit` owns AuditLogId)
  - Cross-module identifier usage is allowed through public module exports (the barrel)
  - Identifier types are considered part of a module's public contract
  - Deep imports remain prohibited

- **D-16 — Audit Event Strategy:**
  - `AuditLog.eventType` remains an **open string**
  - Event ownership belongs to the **originating module**, not the audit module
  - Audit events follow the convention `<aggregate>.<action>` (e.g. `policy.created`, `policy.published`, `user.created`, `role.created`)
  - Modules may expose event constants through their public API when the corresponding behavior is implemented
  - The audit module acts as a **storage mechanism** and does not maintain a centralized registry of all event types

### Service API Surface & Dependency Injection

- **D-17 — Service Surface (Phase 1):**
  - **RoleService:** `createRole`, `findRoleById`, `findRoleByName`, `listRolesByTenant`, `renameRole`, `deleteRole`
  - **UserService:** `createUser`, `findUserById`, `findUserByEmail`, `listUsersByTenant`, `updateUserProfile`, `assignRole`, `setManager`, `deleteUser`
  - Services remain the sole entry point for application logic
  - Repositories are not exposed outside application services
  - Runtime-oriented operations (approval resolution, manager-chain resolution, policy evaluation, approver discovery) are explicitly **deferred to later phases**

- **D-18 — Constructor-Injected Ports:**
  - Application services depend only on repository **port interfaces**
  - Repository implementations are injected through constructors:
    ```ts
    class UserService {
      constructor(
        private readonly userRepo: UserRepositoryPort,
        private readonly roleRepo: RoleRepositoryPort,
      ) {}
    }
    ```
  - Services must never import infrastructure adapters or Convex-specific types
  - Dependency construction occurs at adapter boundaries (Convex handlers)
  - Future composition helpers (module builders) may be introduced if wiring becomes repetitive

- **D-19 — TenantContext (NEW first-class concept):**
  - Tenant isolation is represented through a first-class `TenantContext` object
  - Application service methods accept `TenantContext` as their first parameter:
    ```ts
    userService.createUser(ctx, command);
    roleService.findRoleByName(ctx, name);
    ```
  - `TenantContext` at Phase 1 contains: `{ tenantId: TenantId }`
  - Additional contextual fields (`actorId`, `requestId`, etc.) may be added later without changing service method signatures
  - **Ambient tenant resolution (AsyncLocalStorage, globals) is prohibited.** Tenant context must be passed explicitly from adapter boundaries.
  - **Conceptual parallel with EvaluationContext:**
    - `TenantContext`: _"Who owns this operation?"_ (operational envelope — every service call)
    - `EvaluationContext`: _"What data is being evaluated?"_ (runtime input — every policy evaluation)
  - **Follow-up:** PROJECT.md should be updated at phase transition to surface `TenantContext` as a long-lived architectural pattern alongside `EvaluationContext`.

- **D-20 — Service-First Testing:**
  - Phase 1 testing priority:
    1. Service unit tests using in-memory repository fakes
    2. Adapter mapping tests (Convex `Id<>` ↔ branded ID round-trips, document ↔ entity shape)
    3. Lightweight Convex wiring smoke tests (handler exists, accepts shape, returns shape)
  - **Critical business paths must achieve 90%+ coverage** (engineering.md):
    - tenant isolation
    - role uniqueness within tenant
    - manager assignment + cycle prevention
    - role lookup
    - user lookup
  - Full Convex runtime integration tests are deferred
  - Business logic correctness is prioritized over framework coverage
  - **Every production bug must be accompanied by a regression test**

### Claude's Discretion

The following are not locked — the planner and researcher may pick concrete approaches consistent with the decisions above:

- Concrete ESLint plugin configuration syntax (e.g., `import/no-restricted-paths` shape)
- Exact directory file naming inside modules (e.g., `RoleService.ts` vs `role.service.ts` — pick one and apply consistently)
- Timestamp encoding (epoch ms vs ISO string) on audit entries — Convex idiom is epoch ms
- Test helper utilities (in-memory repository builder, TenantContext factory, etc.)
- Error type strategy (custom error classes per module vs `Result<T, E>` — propose during planning)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or implementing.**

### Vision & Architecture

- `.planning/PROJECT.md` — Project vision, runtime formula `Policy + EvaluationContext → Decision`, Concept Hierarchy, Key Decisions, Hexagonal + Modular Monolith architecture, domain-neutrality constraint
- `.planning/PROJECT.md` §"Concept Hierarchy" — canonical mental model for module ordering
- `.planning/PROJECT.md` §"Constraints" — no `eval()`, no `any`, Pure TS, 100% test coverage on policy engine

### Requirements

- `.planning/REQUIREMENTS.md` §CON (CON-01..04) — Multi-tenancy + dynamic roles + stable roleId + managerId
- `.planning/REQUIREMENTS.md` §POL (POL-05, POL-06) — Policy/PolicyVersion entity skeletons
- `.planning/REQUIREMENTS.md` §AUD (AUD-03) — AuditLog entity skeleton

### Phase Plan & Success Criteria

- `.planning/ROADMAP.md` §"Phase 1: Core Platform Foundations" — phase goal, dependencies, success criteria, plan breakdown

### Engineering Standards (HARD constraints)

- `docs/engineering.md` §"Testing Requirements" — Vitest + RTL stack; 100% on Policy Engine (Phase 2); 90%+ on critical business logic
- `docs/engineering.md` §"Architecture Rules" — Policy Engine isolated from UI; no hardcoded approval logic, tenant-specific conditions, special-case business logic
- `docs/engineering.md` §"Code Quality" — TS strict mode, ESLint, Prettier; no `any`, no `eval()`, no dynamic code execution; prefer deterministic logic, pure functions, explicit types
- `docs/engineering.md` §"CI/CD Requirements" — GitHub Actions pipeline (install · lint · type-check · test · build)
- `docs/engineering.md` §"MVP Principle" — no premature scale optimization, no unnecessary abstractions, boring solutions

### Domain Background (read for context, not for decisions)

- `docs/idea.md` — Original product vision, tech stack baseline (React/TS/Convex/Convex Auth/Monaco/Vercel), out-of-scope features. **Note:** the DSL-related sections are SUPERSEDED by PROJECT.md's JSON-first decision. Read for tech-stack and product-vision context only.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **None.** Greenfield repository — no `src/`, no `convex/`, no `package.json` at root yet. Phase 1 bootstraps everything.

### Established Patterns

- **Planning documents in `.planning/`** — PROJECT/REQUIREMENTS/ROADMAP/STATE govern phase scope. CONTEXT.md (this file) governs implementation decisions for Phase 1.
- **Concept Hierarchy in PROJECT.md is canonical** — module naming and order in `src/modules/` must follow it (directory, policy, runtime, decision, audit).
- **DSL is REJECTED** — JSON-first only. Do NOT introduce lexer/parser/AST during research or planning.

### Integration Points

- **Convex** is the only persistence + serverless function platform — initialize a Convex project as part of Phase 1.
- **Convex Auth** is the planned auth provider (per `docs/idea.md`), but Phase 1 scope does NOT include auth implementation — only ensure the `tenants`/`users` schema can later accommodate Convex Auth identities. Auth wiring belongs to a later phase.
- **Vitest** is the test runner — set up in Phase 1.

</code_context>

<specifics>
## Specific Ideas

- **Module naming follows the Concept Hierarchy verbatim** (M's refinement): `directory`, `policy`, `runtime`, `decision`, `audit`. NOT per-entity (`tenant`, `user`, `role`, `policy`, ...). This was the most decisive structural call of the discussion and applies forever.
- **TenantContext was introduced during this discussion (D-19) as a deliberate mirror of EvaluationContext** — two parallel envelopes:
  - `TenantContext`: "Who owns this operation?"
  - `EvaluationContext`: "What data is being evaluated?"
    M explicitly framed this as "the abstraction worth keeping long-term for Mini-stry." Researcher and planner must treat `TenantContext` with the same architectural weight as `EvaluationContext`.
- **The Boundary Rule wording M wants in the codebase:**
  > "Cross-module imports are ALLOWED. Cross-module coupling is NOT."
  > Use this wording in the root README or ARCHITECTURE.md when documenting the rule. The "system goblin version of Modular Monolith" framing — modules talk through the front door, never through the windows.
- **Each module gets its own `README.md`** documenting public API exports + "do not import internals" — non-negotiable, even though it looks redundant. Agents will read these in future sessions.
- **`policyVersions.content` shape is INTENTIONALLY undefined at Phase 1.** Phase 2 owns the JSON schema for `content`. Resist any temptation to lock the shape now — it would couple storage to runtime concerns.

</specifics>

<deferred>
## Deferred Ideas

- **Composition helpers / module builders** (D-18 footnote) — if dependency wiring across services becomes repetitive, introduce a per-module factory like `createDirectoryModule({ db })`. Defer until pain emerges.
- **PROJECT.md update for `TenantContext`** — at phase transition (after Phase 1 verification), update PROJECT.md to surface `TenantContext` alongside `EvaluationContext` in the Context/Constraints sections (and possibly the Concept Hierarchy).
- **Full Convex runtime integration tests** — deferred per D-20. Revisit when a runtime-touching bug escapes the service-first test layer.
- **Convex Auth wiring** — scope deferred. Phase 1 only ensures the directory schema can later accommodate Convex Auth identity records.
- **Closed audit event registry** — D-16 keeps `eventType` open with per-module constants. If event drift becomes a real problem in Phase 4+, consider a typed registry.
- **Class-based aggregates** (D-13 footnote) — introduce only when a concrete domain behavior demands invariants that plain-data shapes can't enforce.
- **Tenant-scoped service factories** — currently rejected in favor of explicit `TenantContext` per call (D-19). Revisit only if call sites become genuinely painful.

</deferred>

---

_Phase: 1-Core Platform Foundations_
_Context gathered: 2026-05-31_
