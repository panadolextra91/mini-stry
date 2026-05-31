# Phase 1: Core Platform Foundations — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `01-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 1-Core Platform Foundations
**Areas discussed:** Directory layout, Convex schema for tenant isolation & role registry, Phase-1 entity field sets & ID typing, Service API surface for RoleService & UserService

---

## Directory Layout

### Q1 — Layout for `src/`?

| Option | Description | Selected |
|--------|-------------|----------|
| Module-first (Recommended) | `src/modules/<feature>/{domain,application,adapters}` | ✓ (refined) |
| Layer-first | `src/{domain,application,adapters}/<feature>` | |
| Hybrid | `src/{domain,application}` shared + `src/modules/` orchestration | |
| Let Claude decide | Pick canonical Hexagonal | |

**User's choice:** Module-first, **refined**: modules follow the Concept Hierarchy from PROJECT.md (`directory`, `policy`, `runtime`, `decision`, `audit`), NOT per-entity. Tenant/User/Role are entities INSIDE the `directory` bounded context.
**Notes:** "Theo product vision cuối cùng của Mini-stry: Directory → Policy → Runtime → Decision mới là các module thật sự. Tenant/User/Role chỉ là những entity sống bên trong Directory Context thôi."

### Q2 — `convex/` ↔ `src/modules/` relationship?

| Option | Description | Selected |
|--------|-------------|----------|
| Convex = adapter handlers (Recommended) | Thin handlers delegate to `src/modules/*/application` | ✓ |
| Logic in `convex/` | Service logic written directly in Convex files | |
| Let Claude decide | Hexagonal canonical | |

**User's choice:** Option 1 + locked a HARD rule for convex/ MAY / MAY NOT.
**Notes:** convex/ MAY: validate input shape · instantiate dependencies · call application services · map responses. convex/ MAY NOT: evaluate policies · enforce business rules · perform approval routing · contain domain logic.

### Q3 — Module boundary enforcement?

| Option | Description | Selected |
|--------|-------------|----------|
| ESLint + barrel + README (Recommended) | `import/no-restricted-paths` + `index.ts` + module-level README.md | ✓ (rewritten) |
| Barrel only | Convention + code review | |
| ESLint only | No barrel enforcement | |
| Convention only | Code review catches drift | |

**User's choice:** Option 1, completely rewritten.
**Notes:** Replaced "No Cross Module Imports" framing with "**Cross-module imports are ALLOWED. Cross-module coupling is NOT.**" Public API only via barrel `index.ts`. README.md per module is mandatory. Rationale: forbidding cross-module imports creates a "shared monster" anti-pattern; what we actually want to forbid is deep imports into other modules' internals.

### Q4 — Repo shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Single package (Recommended) | One `package.json`, one `tsconfig.json` | ✓ |
| pnpm workspaces | Each module = workspace package | |
| Let Claude decide | MVP principle | |

**User's choice:** Single package.
**Notes:** Defer workspace splits until genuinely needed.

---

## Convex Schema for Tenant Isolation & Role Registry

### Q1 — Tenant isolation at schema layer?

| Option | Description | Selected |
|--------|-------------|----------|
| `tenantId` + composite index (Recommended) | Every entity has `tenantId`; indexes prefix `tenantId` | ✓ (D-09) |
| Sub-document per tenant | Each tenant as one document with nested data | |
| Separate Convex deployments per tenant | 1 deployment per tenant | |
| Let Claude decide | Convex idiom | |

**User's choice:** Option 1, formalized as **D-09**.
**Notes:** "Tenant is treated as a security and ownership boundary, not merely a data attribute."

### Q2 — Role registry & User.roleId?

| Option | Description | Selected |
|--------|-------------|----------|
| Single `roles` table + `[tenantId,name]` unique (Recommended) | Per-tenant rows, stable `roleId` | ✓ (D-10 refined) |
| Hardcoded enum | Static role list | |
| Let Claude decide | Recommended | |

**User's choice:** Option 1, formalized as **D-10**.
**Notes:** Roles tenant-owned, names unique within tenant, IDs stable, names are mutable display attributes.

### Q3 — `User.managerId` nullability & cycle prevention?

| Option | Description | Selected |
|--------|-------------|----------|
| Nullable + app-layer cycle guard (Recommended) | `UserService` walks chain on assign | ✓ (D-11) |
| Required + root sentinel | No null, every tenant has a root user | |
| Nullable + no cycle check | Trust the developer | |
| Let Claude decide | Recommended | |

**User's choice:** Option 1, formalized as **D-11**.
**Notes:** Manager must exist + same tenant + no cycles. Repository and schema layers stay persistence-only.

### Q4 — Phase-1 skeleton table fields?

| Option | Description | Selected |
|--------|-------------|----------|
| Conservative skeletons (Recommended) | Identity + tenant + audit timestamps; no content field | |
| Full schemas incl. content shape | Lock JSON rules content at Phase 1 | |
| Bare metadata only | Just id + tenantId + timestamps | |
| Let Claude decide | Recommended | |

**User's choice:** Refined option — **D-12** keeps `content` field BUT shape is intentionally undefined at Phase 1. Phase 2 (runtime) owns content schema validation.
**Notes:** Separates **storage shape (Phase 1)** from **content shape (Phase 2 runtime)**. Establishes canonical storage model without prematurely defining policy language structures.

---

## Phase-1 Entity Field Sets & ID Typing

### Q1 — Domain entity granularity?

| Option | Description | Selected |
|--------|-------------|----------|
| Plain TS types (Recommended) | Interface/type shape, no methods | ✓ (D-13) |
| Class-based aggregates | Private ctor + static factory + invariants | |
| Type alias minimal | `type Policy = { ... }`, plain string IDs | |
| Let Claude decide | Recommended | |

**User's choice:** Option 1, formalized as **D-13**.
**Notes:** "Avoid ceremonial OOP. Prefer simple, serializable data structures that map cleanly to Convex documents."

### Q2 — ID typing in domain?

| Option | Description | Selected |
|--------|-------------|----------|
| Branded string types per entity (Recommended) | `type TenantId = string & { __brand: 'TenantId' }` | ✓ (D-14) |
| Plain string everywhere | Simplest, no compile-time safety | |
| Tagged union via class wrapper | `class TenantId { constructor(public value: string) {} }` | |
| Let Claude decide | Recommended | |

**User's choice:** Option 1, formalized as **D-14**.
**Notes:** Domain stays Convex-agnostic; adapters map `Id<>` ↔ branded IDs at the boundary.

### Q3 — ID ownership?

| Option | Description | Selected |
|--------|-------------|----------|
| Each module owns its IDs via barrel (Recommended) | `directory` owns Tenant/User/Role IDs; etc. | ✓ (D-15) |
| Shared `src/shared/types/ids.ts` | All IDs in one shared file | |
| Directory owns ALL identity | Even PolicyId/AuditLogId | |
| Let Claude decide | Recommended | |

**User's choice:** Option 1, formalized as **D-15**.
**Notes:** Identifier types are part of a module's public contract. Cross-module use through public barrel only.

### Q4 — `AuditLog.eventType` strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Open string + per-module constants (Recommended) | Modules register their event constants via barrel | ✓ (D-16) |
| Closed union ngay Phase 1 | `'policy.published' \| 'request.evaluated' \| ...` | |
| Open string, no convention | Free-for-all | |
| Let Claude decide | Recommended | |

**User's choice:** Option 1, formalized as **D-16**.
**Notes:** Convention `<aggregate>.<action>`. Originating module owns the event. Audit module is dumb storage, no central registry.

---

## Service API Surface for RoleService & UserService

### Q1 — Method surface?

| Option | Description | Selected |
|--------|-------------|----------|
| CRUD + tenant-scoped queries (Recommended) | Admin-portal-grade surface | ✓ (D-17) |
| CRUD only | Minimal surface | |
| Full incl. Phase 5 resolvers | Manager-chain walk, approver discovery | |
| Let Claude decide | Recommended | |

**User's choice:** Option 1, formalized as **D-17**.
**Notes:** Services remain sole entry point for application logic. Runtime/resolver helpers explicitly deferred.

### Q2 — DI shape for repositories?

| Option | Description | Selected |
|--------|-------------|----------|
| Constructor-injected port interfaces (Recommended) | Services own port refs | ✓ (D-18) |
| Factory function with deps | `createRoleService({ roleRepo })` | |
| Service imports repo directly | Breaks Hexagonal | |
| Let Claude decide | Recommended | |

**User's choice:** Option 1, formalized as **D-18**.
**Notes:** Services never import infrastructure adapters or Convex-specific types. Wiring at adapter boundary.

### Q3 — Multi-tenant scoping?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit `tenantId` param every method (Recommended) | `roleService.findByName(tenantId, name)` | |
| Tenant-scoped service per request | Instantiate new service per request | |
| Ambient tenant context (AsyncLocalStorage) | Hidden context | |
| Let Claude decide | Recommended | |

**User's choice:** **None of the above** — introduced a new pattern: `TenantContext` as a first-class object (**D-19**).
**Notes:** "Tao chọn: None. 🤣 Tao chọn: TenantContext vì nó align cực đẹp với EvaluationContext mà tụi mình vừa cực khổ đưa vào narrative. Một cái đại diện: 'Who owns this operation?' — Một cái đại diện: 'What data is being evaluated?' — Hai context song song. Đó mới là abstraction tao thấy đáng giữ lâu dài cho Mini-stry."

### Q4 — Test surface for Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Service-first unit tests + smoke (Recommended) | In-memory repo fakes + light Convex wiring smoke | ✓ (D-20) |
| Full Convex integration tests | Boot Convex test runtime per test | |
| Unit tests only, skip Convex layer | No wiring verification | |
| Let Claude decide | Recommended | |

**User's choice:** Option 1, formalized as **D-20**.
**Notes:** "Mini-stry = Policy Runtime. Không phải: Mini-stry = Convex Demo App." Critical paths must achieve 90%+ coverage. Every production bug accompanied by a regression test.

---

## Claude's Discretion

- Exact ESLint plugin syntax for `import/no-restricted-paths`
- File naming convention inside modules (PascalCase vs kebab-case — pick one, apply consistently)
- Audit timestamp encoding (epoch ms vs ISO) — Convex idiom is ms
- Test helper utilities (in-memory repo builder, TenantContext factory)
- Error type strategy (custom error classes vs `Result<T, E>` — propose during planning)

## Deferred Ideas

- Composition helpers / module builders if DI wiring becomes repetitive
- PROJECT.md update at phase transition to surface `TenantContext` alongside `EvaluationContext`
- Full Convex runtime integration tests
- Convex Auth wiring (later phase)
- Closed audit event registry if event drift becomes a problem
- Class-based aggregates if domain invariants demand them
- Tenant-scoped service factories — currently rejected in favor of explicit `TenantContext`
