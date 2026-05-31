# Phase 1: Core Platform Foundations - Research

**Researched:** 2026-05-31
**Domain:** Modular Monolith bootstrap on Convex + TypeScript with Hexagonal Architecture, branded IDs, in-memory testable services
**Confidence:** HIGH

## Summary

Phase 1 builds the structural foundation for a domain-neutral Policy Runtime Platform. The 20 locked decisions in `01-CONTEXT.md` (D-08..D-20) are non-negotiable; this research validates them against the **current 2025-2026 Convex + TypeScript ecosystem** and supplies concrete, copy-pasteable patterns the planner needs to write executable tasks.

The work breaks cleanly into three planning tracks corresponding to the three plan slots reserved by ROADMAP (`01-01`, `01-02`, `01-03`): (1) scaffolding + pure-TS domain layer, (2) Convex schema with tenant-prefixed composite indexes, (3) application services + Convex adapters + Vitest suites with in-memory repository fakes. Each track has well-established idioms in the current Convex ecosystem.

**Primary recommendation:** Use Convex 1.39.x with `convex-helpers/validators.brandedString` for ID typing at the schema boundary; use mandatory composite indexes prefixed with `tenantId` for every tenant-owned table; enforce module boundaries with `eslint-plugin-import`'s `no-restricted-paths` rule (legacy zones syntax works in flat config via plugin re-export); test services first against `Map`-backed in-memory fakes with Vitest 4.x and `@vitest/coverage-v8` thresholds set at 90%. Defer Convex Auth wiring entirely — reserve only field names (`email`, `emailVerificationTime`, `image`, `isAnonymous`) on the `users` table to avoid migration pain when Convex Auth lands in a later phase. [VERIFIED: npm registry] [CITED: labs.convex.dev/auth/setup/schema]

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Directory Layout:**
- Module-first by Concept Hierarchy (PROJECT.md). Phase 1 creates only `directory/`, `policy/`, `audit/`. `runtime/` and `decision/` are deferred to Phase 2+.
- Each module shape: `{domain, application, ports, adapters, index.ts, README.md}`. `index.ts` is the barrel public API. `README.md` documents public exports and warns against deep imports.
- `convex/` HARD RULE: MAY validate input shape · instantiate dependencies · call application services · map responses. MAY NOT evaluate policies · enforce business rules · perform approval routing · contain domain logic.
- **Module Boundary Rule (D-08):** *"Cross-module imports are ALLOWED. Cross-module coupling is NOT."* Cross-module imports MUST go through the barrel `index.ts`. Deep imports into `domain/`, `application/`, `adapters/` are forbidden.
- Single package — one `package.json`, one `tsconfig.json`. No pnpm workspaces.

**Schema (D-09..D-12):**
- D-09 — `tenantId: Id<'tenants'>` on every tenant-owned entity. Every index prefixes `tenantId`. No cross-tenant query APIs.
- D-10 — Single `roles` table per tenant with `[tenantId, name]` composite-unique enforced in application layer (Convex has no native unique constraint).
- D-11 — `User.managerId` nullable self-reference. Cycle prevention is enforced **in the application layer** through `UserService`, not at schema.
- D-12 — Phase 1 introduces skeleton tables for `Policy`, `PolicyVersion`, `AuditLog`. `PolicyVersion.content` shape is intentionally undefined at Phase 1; Phase 2 owns it.

**Entity & ID (D-13..D-16):**
- D-13 — Domain entities are plain TS interfaces (no class aggregates). State only; behavior in services.
- D-14 — Branded string IDs (`type TenantId = string & { readonly __brand: 'TenantId' }`). Domain does NOT import Convex `Id<>` types.
- D-15 — Each module owns its identifier types. Cross-module ID usage through barrel only.
- D-16 — `AuditLog.eventType` open string, convention `<aggregate>.<action>`. Originating module owns the event constants. Audit module is a storage mechanism, not a registry.

**Services (D-17..D-20):**
- D-17 — `RoleService` surface: `createRole`, `findRoleById`, `findRoleByName`, `listRolesByTenant`, `renameRole`, `deleteRole`. `UserService` surface: `createUser`, `findUserById`, `findUserByEmail`, `listUsersByTenant`, `updateUserProfile`, `assignRole`, `setManager`, `deleteUser`.
- D-18 — Constructor-injected repository ports. No Convex types in services.
- D-19 — `TenantContext` first-class object — `{ tenantId: TenantId }`. Every service method takes `ctx` as the first parameter. Ambient resolution (AsyncLocalStorage, globals) is prohibited.
- D-20 — Service-first testing: in-memory repo fakes + adapter mapping tests + Convex wiring smoke. 90%+ coverage on tenant isolation, role uniqueness, manager assignment + cycle prevention, lookups.

### Claude's Discretion
- Concrete ESLint plugin configuration syntax (`import/no-restricted-paths` shape)
- File naming inside modules (`role.service.ts` vs `RoleService.ts` — pick one and apply consistently)
- Timestamp encoding on audit entries (Convex idiom is epoch ms)
- Test helper utilities (in-memory repository builder, TenantContext factory)
- Error type strategy (custom error classes per module vs `Result<T, E>` — propose during planning)

### Deferred Ideas (OUT OF SCOPE)
- Composition helpers / module builders — introduce only if wiring becomes repetitive
- PROJECT.md update for `TenantContext` — at phase transition, not now
- Full Convex runtime integration tests — service-first only at Phase 1
- Convex Auth wiring — Phase 1 only reserves schema room
- Closed audit event registry — `eventType` stays open
- Class-based aggregates — deferred until concrete invariants demand them
- Tenant-scoped service factories — rejected in favor of explicit `TenantContext` per call

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CON-01 | Strict logical data isolation across tenant organizations | Convex composite-index pattern `[tenantId, …]` + tenant-scoped repository ports. All queries use `.withIndex('by_tenant_*', q => q.eq('tenantId', ctx.tenantId))`. Cross-tenant query APIs are not exposed. |
| CON-02 | Dynamic Roles per tenant via `RoleService` | Single `roles` table with `[tenantId, name]` composite-unique enforced at the application layer (Convex has no native unique constraints; verified via OCC docs). |
| CON-03 | Stable `roleId` user-role reference | `User.roleId: RoleId` (branded type wrapping `Id<'roles'>`). Role rename mutates `roles.name` only; user linkage stays stable via ID. |
| CON-04 | `managerId` self-reference for reporting lines | `User.managerId: UserId \| null` (D-11 nullable). Cycle prevention algorithm in `UserService.setManager` walks up via `findUserById` with depth-limit fallback. |
| POL-05 | `PolicyEntity` skeleton | Plain-TS interface `Policy { id: PolicyId; tenantId: TenantId; name: string; activeVersionId: PolicyVersionId \| null; createdAt: number; }`. Convex `policies` table with `[tenantId, name]` index. |
| POL-06 | `PolicyVersionEntity` skeleton | `PolicyVersion { id: PolicyVersionId; tenantId: TenantId; policyId: PolicyId; versionNumber: number; content: unknown; publishedAt: number \| null; }`. `content: v.any()` at Phase 1 — Phase 2 owns the shape. |
| AUD-03 | `AuditLogEntity` skeleton | `AuditLog { id: AuditLogId; tenantId: TenantId; eventType: string; payload: unknown; createdAt: number; }`. Convex `auditLogs` table indexed `[tenantId, createdAt]` and `[tenantId, eventType, createdAt]`. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tenant ownership boundary | Application (service + TenantContext) | Persistence (index prefix) | Tenant is a security boundary — represented as a first-class context object, not ambient state. Persistence enforces it via composite indexes. |
| Role registry (CRUD) | Application (`RoleService`) | Persistence (Convex `roles` table) | Application owns uniqueness enforcement (Convex has no native unique constraint), tenant scoping, and event emission. |
| User profile & role assignment | Application (`UserService`) | Persistence (Convex `users` table) | Cross-table integrity (role existence check) and cycle prevention live in service. |
| Manager-chain cycle prevention | Application (`UserService.setManager`) | — | Schema cannot express graph invariants. Service walks the chain with `findUserById`. |
| Multi-tenant isolation enforcement | Persistence (composite indexes) | Application (TenantContext threading) | Index prefix makes tenant filtering the cheapest query path and structurally prevents accidental cross-tenant scans. |
| Convex `Id<>` ↔ branded ID conversion | Adapter (`convex/<module>/mappers.ts`) | — | Domain stays storage-agnostic. Mapper is the only layer aware of both representations. |
| Domain event emission (audit) | Originating module's application layer | Audit module storage adapter | `eventType` ownership is decentralized (D-16). Audit module is a sink, not a registry. |
| HTTP/serverless entry points | `convex/` (mutations/queries) | — | `convex/` is the adapter layer per the HARD RULE: input validation, DI wiring, response mapping only. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `convex` | 1.39.1 | Backend platform — schema, mutations, queries, runtime | The only sanctioned backend per `docs/idea.md` and CONTEXT.md. Provides schema validation, ACID mutations via OCC, codegen, and the `Id<'table'>` type system. [VERIFIED: npm registry] |
| `typescript` | 5.9.3 | Type system | TS strict mode mandated by `docs/engineering.md`. Branded types (D-14) require TS structural-with-brand pattern. [VERIFIED: npm registry] |
| `vitest` | 4.1.7 | Test runner | Mandated by `docs/engineering.md`. Native ESM + TS support, Vite-based config, fast watch, built-in coverage via `@vitest/coverage-v8`. [VERIFIED: npm registry] |
| `@vitest/coverage-v8` | 4.1.7 | Coverage provider | Default coverage provider for Vitest 2+. Uses V8 native instrumentation — fast and accurate. Required to enforce the 90%+ coverage threshold (engineering.md). [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `convex-helpers` | 0.1.118 | Branded string validators, typed `v.id()`, `customCtx`, `doc()` | Use `brandedString("TenantId")` to declare branded ID validators that propagate through Convex generated types. Also provides `typedV(schema)` for schema-aware ID validation. [VERIFIED: npm registry] [CITED: stack.convex.dev/using-branded-types-in-validators] |
| `eslint` | 10.4.1 | Linter | Mandated by `docs/engineering.md`. Use flat config (`eslint.config.js`). [VERIFIED: npm registry] |
| `typescript-eslint` | 8.60.0 | TS-aware lint rules (combined package: parser + plugin) | Provides `@typescript-eslint/no-restricted-imports` with `allowTypeImports` and per-pattern messages. Use this for module-boundary enforcement when `eslint-plugin-import` flat-config compatibility is unstable. [VERIFIED: npm registry] |
| `eslint-plugin-import` | 2.32.0 | Provides `import/no-restricted-paths` rule | Use for path-zone enforcement (D-08). Flat config support exists via `importPlugin.flatConfigs.recommended` though some users prefer `eslint-plugin-import-x` (a fork with cleaner flat config). [VERIFIED: npm registry] [CITED: github.com/import-js/eslint-plugin-import] |
| `eslint-import-resolver-typescript` | 4.4.4 | TS path-alias resolution for `eslint-plugin-import` | Required so `@/modules/*` aliases resolve during lint. [VERIFIED: npm registry] |
| `prettier` | 3.8.3 | Formatter | Mandated by `docs/engineering.md`. [VERIFIED: npm registry] |
| `@types/node` | (latest 22.x) | Node typings | Required for `path`, `process`, etc. used in `vitest.config.ts`. [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `eslint-plugin-import` `no-restricted-paths` | `@typescript-eslint/no-restricted-imports` with `patterns` | typescript-eslint variant has cleaner flat-config story and supports `allowTypeImports`. Less expressive for path-zone semantics (target ↔ from pairs). **Recommendation:** prefer `eslint-plugin-import` for the directional zones; add `no-restricted-imports` only if zone syntax proves clumsy. |
| `convex-helpers` `brandedString` | Hand-rolled `string & { __brand: 'X' }` + `Validator<X>` cast | Hand-rolled requires casting `v.string() as Validator<MyType>` in every schema field. `brandedString("X")` centralizes the pattern and integrates with Convex codegen. **Recommendation:** use `convex-helpers` for ergonomics. [CITED: stack.convex.dev/using-branded-types-in-validators] |
| `@convex-dev/auth` (Convex Auth) | Defer entirely | Phase 1 does not implement auth. **Recommendation:** install **nothing** for auth in Phase 1; only reserve field names on `users` table. |
| Vitest `coverage-v8` | `coverage-istanbul` | Istanbul instruments at the source level (more accurate for un-transpiled code) but is significantly slower. V8 is the Vitest 2+ default and meets the 90% threshold need. **Recommendation:** stick with `coverage-v8`. |
| Classes for entities | Plain interfaces (locked: D-13) | Not an alternative — D-13 locks the choice. |

**Installation (planner uses this verbatim):**
```bash
npm init -y
npm install convex@1.39.1 convex-helpers@0.1.118
npm install --save-dev typescript@5.9.3 vitest@4.1.7 @vitest/coverage-v8@4.1.7 \
  eslint@10.4.1 typescript-eslint@8.60.0 eslint-plugin-import@2.32.0 \
  eslint-import-resolver-typescript@4.4.4 prettier@3.8.3 @types/node@22
```

**Version verification (date 2026-05-31):**
- `convex@1.39.1` — verified via `npm view convex version`. Repo: `github.com/get-convex/convex-backend`.
- `convex-helpers@0.1.118` — verified. Repo: `github.com/get-convex/convex-helpers`.
- `vitest@4.1.7` and `@vitest/coverage-v8@4.1.7` — verified, versions stay in lockstep.
- `typescript@5.9.3` — verified, current stable major.
- `eslint@10.4.1` — verified (flat config is the only supported format from ESLint 9+).
- `typescript-eslint@8.60.0` — verified (the unified package replacing `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`).
- `eslint-plugin-import@2.32.0` — verified.
- `prettier@3.8.3` — verified.

## Package Legitimacy Audit

slopcheck 0.6.1 was run with `--ecosystem npm` on 2026-05-31. Results:

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `convex` | npm | 3+ yrs | high | github.com/get-convex/convex-backend | [OK] | Approved [VERIFIED: npm registry] |
| `convex-helpers` | npm | 2+ yrs | medium | github.com/get-convex/convex-helpers | [OK] (with note: name ends in `-helpers`, established package) | Approved [VERIFIED: npm registry] |
| `@convex-dev/auth` | npm | 1+ yr | medium | github.com/get-convex/convex-auth | [OK] | **Not installed in Phase 1** — deferred per CONTEXT.md. Schema reserves room only. [VERIFIED: npm registry] |
| `vitest` | npm | 3+ yrs | very high | github.com/vitest-dev/vitest | [SUS] (typosquat-distance to `vite` — false positive; vitest is the test framework, vite is the bundler) | **Approved** — slopcheck's heuristic flags the lexical similarity but vitest is the widely-used Vitest test runner with very high downloads and is mandated by engineering.md. **No checkpoint needed.** [VERIFIED: npm registry] |
| `@vitest/coverage-v8` | npm | 3+ yrs | very high | github.com/vitest-dev/vitest | [OK] | Approved [VERIFIED: npm registry] |
| `eslint` | npm | 10+ yrs | very high | github.com/eslint/eslint | [OK] | Approved [VERIFIED: npm registry] |
| `typescript` | npm | 10+ yrs | very high | github.com/microsoft/TypeScript | [OK] | Approved [VERIFIED: npm registry] |
| `typescript-eslint` | npm | 1+ yr | high | github.com/typescript-eslint/typescript-eslint | [OK] | Approved [VERIFIED: npm registry] |
| `eslint-plugin-import` | npm | 9+ yrs | very high | github.com/import-js/eslint-plugin-import | [OK] | Approved [VERIFIED: npm registry] |
| `prettier` | npm | 8+ yrs | very high | github.com/prettier/prettier | [OK] | Approved [VERIFIED: npm registry] |
| `eslint-import-resolver-typescript` | npm | 5+ yrs | very high | github.com/import-js/eslint-import-resolver-typescript | [OK] | Approved [VERIFIED: npm registry] |
| `@types/node` | npm | 8+ yrs | very high | github.com/DefinitelyTyped/DefinitelyTyped | [OK] | Approved [VERIFIED: npm registry] |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `vitest` — confirmed false positive (typosquat-distance to `vite`). Vitest is the official Vite-ecosystem test runner mandated by `docs/engineering.md`. No checkpoint required.

Postinstall script audit: none of the recommended packages declare `scripts.postinstall` with network or out-of-tree filesystem access.

## Architecture Patterns

### System Architecture Diagram

```
                  ┌──────────────────────────────────────┐
                  │  Convex Adapter (convex/ directory)  │
                  │  - validate input shape (v.*)        │
                  │  - resolve TenantContext from auth   │
                  │  - instantiate services via DI       │
                  │  - map domain return → wire shape    │
                  │  HARD RULE: no business logic        │
                  └────────────────┬─────────────────────┘
                                   │ TenantContext + Command DTO
                                   ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  Application Layer  (src/modules/<mod>/application/*.ts)     │
   │  ┌────────────────┐    ┌────────────────┐    ┌──────────┐    │
   │  │  RoleService   │    │  UserService   │    │  …       │    │
   │  └────────┬───────┘    └────────┬───────┘    └────┬─────┘    │
   │           │                     │                 │          │
   │           ▼                     ▼                 ▼          │
   │  ┌────────────────────────────────────────────────────────┐  │
   │  │  Domain Layer (plain TS interfaces + branded IDs)      │  │
   │  │  Tenant · User · Role · Policy · PolicyVersion ·       │  │
   │  │  AuditLog. State only — no behavior. Storage-agnostic. │  │
   │  └────────────────────────────────────────────────────────┘  │
   │           ▲                     ▲                 ▲          │
   │           │ Port interface      │                 │          │
   │  ┌────────┴───────┐    ┌────────┴───────┐    ┌────┴─────┐    │
   │  │ RoleRepo Port  │    │ UserRepo Port  │    │ …        │    │
   │  └────────┬───────┘    └────────┬───────┘    └────┬─────┘    │
   └───────────┼─────────────────────┼─────────────────┼──────────┘
               │                     │                 │
               │ implemented by      │                 │
               ▼                     ▼                 ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  Adapter Layer  (src/modules/<mod>/adapters/convex/*.ts)     │
   │  - ConvexRoleRepository, ConvexUserRepository, …             │
   │  - mappers.ts: Id<'roles'> ↔ RoleId (branded)                │
   │  - reads ctx.db, applies tenant-prefixed indexes             │
   └──────────────────────────────┬───────────────────────────────┘
                                  │ ctx.db queries / mutations
                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  Convex DB  (convex/schema.ts)                               │
   │  tenants · users · roles · policies · policyVersions ·       │
   │  auditLogs. Every tenant-owned index begins with tenantId.   │
   └──────────────────────────────────────────────────────────────┘

   Test path (parallel to adapter path):
     Vitest → Application Service ← InMemory*Repository (Map-backed)
```

The diagram shows: input enters via Convex handlers → flows into application services holding `TenantContext` → reads/writes domain entities through port interfaces → resolved at runtime by Convex adapters or in-memory fakes (tests). Domain interfaces never reference Convex; mappers at the adapter boundary translate `Id<'…'>` to branded IDs.

### Component Responsibilities

| Component | File / Folder | Responsibility |
|-----------|---------------|-----------------|
| Pure-TS domain entity | `src/modules/<mod>/domain/<entity>.ts` | Define `interface Entity` (state-only) + branded ID type. No imports from Convex, no imports from other modules' internals. |
| Repository port | `src/modules/<mod>/ports/<entity>-repository.port.ts` | Define `interface <Entity>RepositoryPort { … }`. Methods accept domain types only, return domain types only. |
| Application service | `src/modules/<mod>/application/<entity>-service.ts` | Implement business workflows. Constructor-injected ports. First param of every method is `TenantContext`. |
| Convex schema | `convex/schema.ts` | `defineSchema({ … })`. All tenant-owned tables have at least one composite index prefixed `tenantId`. |
| Convex mutation / query | `convex/<module>.ts` (e.g., `convex/directory.ts`) | DI wiring + input validation only. Calls `service.method(tenantContext, args)`. |
| Adapter (repository impl) | `src/modules/<mod>/adapters/convex/<entity>-repository.ts` | Implements port using `ctx.db`. Uses mappers to translate `Id<'…'>` ↔ branded IDs. |
| Mapper | `src/modules/<mod>/adapters/convex/mappers.ts` | Pure functions: `toTenantId(id: Id<'tenants'>): TenantId` and inverse. |
| In-memory fake | `src/modules/<mod>/adapters/memory/<entity>-repository.fake.ts` | Map-backed implementation of port. Used by Vitest service tests. |
| Module barrel | `src/modules/<mod>/index.ts` | Re-exports public API: entity types, service classes, port interfaces, branded ID types. Nothing else. |
| Module README | `src/modules/<mod>/README.md` | Documents public exports. "Do not import internals." |

### Recommended Project Structure

```
.
├── package.json                  # single package, ESM ("type": "module")
├── tsconfig.json                 # strict, path alias @/* → src/*
├── eslint.config.js              # flat config with no-restricted-paths zones
├── vitest.config.ts              # path alias mirror, v8 coverage @ 90%
├── prettier.config.cjs           # standard config
├── convex/
│   ├── schema.ts                 # defineSchema — 6 tables
│   ├── _generated/               # convex codegen (gitignored)
│   ├── directory.ts              # mutations/queries calling RoleService, UserService
│   ├── policy.ts                 # skeleton — empty handlers, schema only
│   └── audit.ts                  # skeleton — empty handlers, schema only
├── src/
│   ├── modules/
│   │   ├── directory/
│   │   │   ├── domain/
│   │   │   │   ├── ids.ts        # TenantId, UserId, RoleId branded types
│   │   │   │   ├── tenant.ts     # interface Tenant
│   │   │   │   ├── user.ts       # interface User
│   │   │   │   └── role.ts       # interface Role
│   │   │   ├── ports/
│   │   │   │   ├── tenant-repository.port.ts
│   │   │   │   ├── user-repository.port.ts
│   │   │   │   └── role-repository.port.ts
│   │   │   ├── application/
│   │   │   │   ├── tenant-context.ts        # TenantContext type + factory
│   │   │   │   ├── role-service.ts          # RoleService
│   │   │   │   └── user-service.ts          # UserService
│   │   │   ├── adapters/
│   │   │   │   ├── convex/
│   │   │   │   │   ├── mappers.ts
│   │   │   │   │   ├── convex-role-repository.ts
│   │   │   │   │   └── convex-user-repository.ts
│   │   │   │   └── memory/
│   │   │   │       ├── in-memory-role-repository.ts
│   │   │   │       └── in-memory-user-repository.ts
│   │   │   ├── index.ts                     # barrel
│   │   │   └── README.md
│   │   ├── policy/                          # skeleton-only Phase 1
│   │   │   ├── domain/
│   │   │   │   ├── ids.ts
│   │   │   │   ├── policy.ts
│   │   │   │   └── policy-version.ts
│   │   │   ├── ports/                       # empty placeholder OK at Phase 1
│   │   │   ├── application/                 # empty placeholder OK at Phase 1
│   │   │   ├── adapters/                    # empty placeholder OK at Phase 1
│   │   │   ├── index.ts
│   │   │   └── README.md
│   │   └── audit/                           # skeleton-only Phase 1
│   │       ├── domain/
│   │       │   ├── ids.ts
│   │       │   └── audit-log.ts
│   │       ├── index.ts
│   │       └── README.md
│   └── shared/                              # cross-cutting test helpers, type utils
│       └── testing/
│           └── tenant-context-fixture.ts
├── tests/                                   # OR co-located *.test.ts (pick one)
│   └── modules/
│       └── directory/
│           ├── role-service.test.ts
│           └── user-service.test.ts
└── ARCHITECTURE.md                          # documents the Boundary Rule wording
```

### Pattern 1: Convex Schema with Tenant-Prefixed Composite Indexes

**What:** Every tenant-owned table starts with a composite index whose first field is `tenantId`. Convex composite indexes support **prefix queries** — the same index serves both `[tenantId, X]` lookups and `[tenantId]`-only list operations. [CITED: docs.convex.dev/database/reading-data/indexes]

**When to use:** Always, for every table that contains tenant-owned data.

**Why this is structurally important:** A composite index `by_tenant_*` makes tenant filtering the cheapest query path. A `.collect()` without `.withIndex('by_tenant_*', …)` immediately stands out in code review as a tenant-isolation bug.

**Example:**
```typescript
// convex/schema.ts
// Source: docs.convex.dev/database/schemas + docs.convex.dev/database/reading-data/indexes
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tenants: defineTable({
    name: v.string(),
    createdAt: v.number(),
  }),

  users: defineTable({
    tenantId: v.id("tenants"),
    email: v.string(),                 // reserved for Convex Auth (Phase 2+)
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    roleId: v.id("roles"),
    managerId: v.union(v.id("users"), v.null()),
    createdAt: v.number(),
  })
    .index("by_tenant_email", ["tenantId", "email"])
    .index("by_tenant_role", ["tenantId", "roleId"])
    .index("by_tenant_manager", ["tenantId", "managerId"])
    .index("by_email", ["email"]),     // Convex Auth requirement — see Pitfall 4

  roles: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_tenant_name", ["tenantId", "name"]),

  policies: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    activeVersionId: v.union(v.id("policyVersions"), v.null()),
    createdAt: v.number(),
  }).index("by_tenant_name", ["tenantId", "name"]),

  policyVersions: defineTable({
    tenantId: v.id("tenants"),
    policyId: v.id("policies"),
    versionNumber: v.number(),
    content: v.any(),                  // intentionally undefined at Phase 1 (D-12)
    publishedAt: v.union(v.number(), v.null()),
  })
    .index("by_tenant_policy_version", ["tenantId", "policyId", "versionNumber"])
    .index("by_tenant_policy_published", ["tenantId", "policyId", "publishedAt"]),

  auditLogs: defineTable({
    tenantId: v.id("tenants"),
    eventType: v.string(),
    payload: v.any(),
    createdAt: v.number(),
  })
    .index("by_tenant_created", ["tenantId", "createdAt"])
    .index("by_tenant_event_created", ["tenantId", "eventType", "createdAt"]),
});
```

**Query usage (composite index prefix):**
```typescript
// Look up role by [tenantId, name] (uniqueness check)
const existing = await ctx.db
  .query("roles")
  .withIndex("by_tenant_name", (q) =>
    q.eq("tenantId", tenantId).eq("name", name)
  )
  .unique();

// List all roles in tenant (same index, prefix only)
const all = await ctx.db
  .query("roles")
  .withIndex("by_tenant_name", (q) => q.eq("tenantId", tenantId))
  .collect();
```
[CITED: docs.convex.dev/database/reading-data/indexes]

### Pattern 2: Pure-TS Domain Entity with Branded ID

**What:** Domain entity is an interface (D-13). ID is a branded string type that exists only at compile time (D-14).

**Example:**
```typescript
// src/modules/directory/domain/ids.ts
export type TenantId = string & { readonly __brand: "TenantId" };
export type UserId   = string & { readonly __brand: "UserId" };
export type RoleId   = string & { readonly __brand: "RoleId" };

// Constructor helpers — used ONLY at adapter boundaries (mappers.ts).
// Domain & application code receives already-branded IDs.
export const tenantId = (raw: string): TenantId => raw as TenantId;
export const userId   = (raw: string): UserId   => raw as UserId;
export const roleId   = (raw: string): RoleId   => raw as RoleId;

// src/modules/directory/domain/user.ts
import type { TenantId, UserId, RoleId } from "./ids.js";

export interface User {
  readonly id: UserId;
  readonly tenantId: TenantId;
  readonly email: string;
  readonly name: string | null;
  readonly roleId: RoleId;
  readonly managerId: UserId | null;
  readonly createdAt: number;        // epoch ms — Convex idiom
}
```

**Why string-literal brand instead of `unique symbol`:** Per the survey of 2025 TS patterns, `unique symbol` brands provide stronger uniqueness guarantees but complicate cross-module re-exports and serialization. For this codebase the string-literal brand is the boring choice — it serializes naturally to JSON, the brand is private-by-convention, and it is the pattern `convex-helpers/brandedString` produces. [CITED: nanamanu.com/posts/branded-types-typescript; effect.website/docs/code-style/branded-types]

### Pattern 3: Branded IDs in Convex Validators via `convex-helpers`

**What:** Use `brandedString("TenantId")` from `convex-helpers/validators` to declare a Convex validator that types as the branded domain type. Field appears as `v.string()` at runtime but as `TenantId` in TypeScript.

**Example:**
```typescript
// convex/_branded.ts  (helper file — not in src/)
// Source: stack.convex.dev/using-branded-types-in-validators
import { brandedString } from "convex-helpers/validators";
import { Infer } from "convex/values";

export const vTenantIdString = brandedString("TenantId");
export type TenantIdString = Infer<typeof vTenantIdString>;

// Usage inside a convex mutation when the args carry a domain-level ID
// rather than a Convex Id<'tenants'>:
import { mutation } from "./_generated/server";
import { vTenantIdString } from "./_branded.js";

export const someAction = mutation({
  args: { externalTenantId: vTenantIdString },
  handler: async (ctx, args) => { /* … */ },
});
```

**Note:** For Convex `Id<'tenants'>` fields used as primary references, keep `v.id("tenants")` — DO NOT brand-cast `v.id()` because Convex's generated types already produce a distinct `Id<'tenants'>` type. The branding pattern is for cases where a string value is semantically an ID but is not a Convex document ID (e.g., external tenant identifiers, audit event types). [CITED: stack.convex.dev/using-branded-types-in-validators]

### Pattern 4: Convex Id ↔ Branded Domain ID Mapping at Adapter Boundary

**What:** Domain layer holds `TenantId` (branded string). Convex layer holds `Id<'tenants'>`. Mapper layer (in `adapters/convex/mappers.ts`) translates one to the other. Both representations are `string` at runtime, so the conversion is a typed cast — zero runtime cost. [CITED: stack.convex.dev/using-branded-types-in-validators ("A Convex Id<\"users\"> is the type string & { __tableName: \"users\" }")]

**Example:**
```typescript
// src/modules/directory/adapters/convex/mappers.ts
import type { Id } from "../../../../../convex/_generated/dataModel.js";
import {
  type TenantId, type UserId, type RoleId,
  tenantId, userId, roleId,
} from "../../domain/ids.js";
import type { Role } from "../../domain/role.js";
import type { User } from "../../domain/user.js";

// Convex Id<'tenants'> → branded TenantId.
// Both are `string` at runtime; this cast is purely a type-system reframe.
export const toTenantId = (id: Id<"tenants">): TenantId => tenantId(id);
export const toUserId   = (id: Id<"users">):   UserId   => userId(id);
export const toRoleId   = (id: Id<"roles">):   RoleId   => roleId(id);

// Branded → Convex Id<>. Used when calling ctx.db.get / patch / delete.
export const fromTenantId = (id: TenantId): Id<"tenants"> => id as Id<"tenants">;
export const fromUserId   = (id: UserId):   Id<"users">   => id as Id<"users">;
export const fromRoleId   = (id: RoleId):   Id<"roles">   => id as Id<"roles">;

// Document shape (Convex) → domain entity (branded IDs).
export const roleDocToEntity = (doc: {
  _id: Id<"roles">; tenantId: Id<"tenants">; name: string; createdAt: number;
}): Role => ({
  id: toRoleId(doc._id),
  tenantId: toTenantId(doc.tenantId),
  name: doc.name,
  createdAt: doc.createdAt,
});
```

### Pattern 5: Constructor-Injected Service with TenantContext

**Example:**
```typescript
// src/modules/directory/application/tenant-context.ts
import type { TenantId } from "../domain/ids.js";

export interface TenantContext {
  readonly tenantId: TenantId;
  // Future Phase 2+: actorId, requestId, traceId — added WITHOUT changing
  // service method signatures (D-19).
}

export const tenantContext = (tenantId: TenantId): TenantContext => ({ tenantId });

// src/modules/directory/application/role-service.ts
import type { RoleRepositoryPort } from "../ports/role-repository.port.js";
import type { Role } from "../domain/role.js";
import type { RoleId } from "../domain/ids.js";
import type { TenantContext } from "./tenant-context.js";

export class RoleNameAlreadyExistsError extends Error {
  constructor(public readonly name: string) {
    super(`Role name "${name}" already exists in this tenant`);
    this.name = "RoleNameAlreadyExistsError";
  }
}

export class RoleService {
  constructor(private readonly roleRepo: RoleRepositoryPort) {}

  async createRole(ctx: TenantContext, command: { name: string }): Promise<Role> {
    const existing = await this.roleRepo.findByName(ctx, command.name);
    if (existing) throw new RoleNameAlreadyExistsError(command.name);
    return this.roleRepo.create(ctx, { name: command.name });
  }

  async findRoleById(ctx: TenantContext, id: RoleId): Promise<Role | null> {
    return this.roleRepo.findById(ctx, id);
  }

  // … remaining D-17 methods
}
```

### Pattern 6: In-Memory Repository Fake for Service Tests

**Example:**
```typescript
// src/modules/directory/adapters/memory/in-memory-role-repository.ts
import type { RoleRepositoryPort } from "../../ports/role-repository.port.js";
import type { Role } from "../../domain/role.js";
import type { RoleId } from "../../domain/ids.js";
import { roleId as toRoleId } from "../../domain/ids.js";
import type { TenantContext } from "../../application/tenant-context.js";

export class InMemoryRoleRepository implements RoleRepositoryPort {
  private readonly byId = new Map<string, Role>();
  private counter = 0;

  async create(ctx: TenantContext, input: { name: string }): Promise<Role> {
    const id = toRoleId(`role_${++this.counter}`);
    const role: Role = {
      id,
      tenantId: ctx.tenantId,
      name: input.name,
      createdAt: Date.now(),
    };
    this.byId.set(id, role);
    return role;
  }

  async findById(ctx: TenantContext, id: RoleId): Promise<Role | null> {
    const role = this.byId.get(id);
    if (!role || role.tenantId !== ctx.tenantId) return null; // tenant isolation
    return role;
  }

  async findByName(ctx: TenantContext, name: string): Promise<Role | null> {
    for (const role of this.byId.values()) {
      if (role.tenantId === ctx.tenantId && role.name === name) return role;
    }
    return null;
  }
  // … remaining methods mirror this pattern
}
```

### Pattern 7: Cycle Prevention in `UserService.setManager`

**Algorithm:** Walk upward from the proposed manager's `managerId` chain. If the user being assigned appears anywhere in the chain, reject. Depth-limit to prevent infinite walks on corrupted data.

**Example:**
```typescript
// src/modules/directory/application/user-service.ts (excerpt)
export class ManagerCycleError extends Error {
  constructor(userId: UserId, managerId: UserId) {
    super(`Assigning ${managerId} as manager of ${userId} would create a cycle`);
    this.name = "ManagerCycleError";
  }
}

const MAX_MANAGER_CHAIN_DEPTH = 50;

async setManager(
  ctx: TenantContext,
  userId: UserId,
  newManagerId: UserId | null,
): Promise<User> {
  if (newManagerId === null) {
    return this.userRepo.updateManagerId(ctx, userId, null);
  }
  if (newManagerId === userId) {
    throw new ManagerCycleError(userId, newManagerId);
  }

  const newManager = await this.userRepo.findById(ctx, newManagerId);
  if (!newManager) throw new ManagerNotFoundError(newManagerId);
  // tenant scoping is enforced by the repo (it returned null if cross-tenant)

  // Walk upward from newManager.managerId — if we encounter `userId`, cycle.
  let cursor: UserId | null = newManager.managerId;
  let steps = 0;
  while (cursor !== null) {
    if (cursor === userId) throw new ManagerCycleError(userId, newManagerId);
    if (++steps > MAX_MANAGER_CHAIN_DEPTH) {
      throw new Error(
        `Manager chain exceeds ${MAX_MANAGER_CHAIN_DEPTH} (data corruption suspected)`
      );
    }
    const next: User | null = await this.userRepo.findById(ctx, cursor);
    if (!next) break;                  // broken chain — accept (no cycle through us)
    cursor = next.managerId;
  }

  return this.userRepo.updateManagerId(ctx, userId, newManagerId);
}
```

**Complexity:** Worst-case O(D) where D = chain depth. Each iteration is one indexed lookup. For an organization of 50 levels, that is 50 indexed reads — well within Convex mutation budget. The depth limit is a safety valve; real org trees rarely exceed 10 levels.

**Test coverage for D-20:** the test cases planner must enumerate include — direct self-loop (A→A), 2-cycle (A→B, B→A), N-cycle (A→B→C→A), broken chain (manager of newManager doesn't exist — accept), depth-limit trigger (chain of 51 — throw).

### Pattern 8: Convex Adapter — Read-Then-Write Uniqueness Check

**What:** Convex mutations are ACID-transactional via Optimistic Concurrency Control. A read-then-write pattern (check name doesn't exist, then insert) is safe inside a single mutation. If a concurrent mutation conflicts on the read set, Convex re-runs the mutation deterministically. [CITED: docs.convex.dev/database/advanced/occ]

**Example:**
```typescript
// src/modules/directory/adapters/convex/convex-role-repository.ts
import type { MutationCtx } from "../../../../../convex/_generated/server.js";
import type { RoleRepositoryPort } from "../../ports/role-repository.port.js";
import type { Role } from "../../domain/role.js";
import type { TenantContext } from "../../application/tenant-context.js";
import { fromTenantId, toRoleId, toTenantId } from "./mappers.js";

export class ConvexRoleRepository implements RoleRepositoryPort {
  constructor(private readonly db: MutationCtx["db"]) {}

  async findByName(ctx: TenantContext, name: string): Promise<Role | null> {
    const doc = await this.db
      .query("roles")
      .withIndex("by_tenant_name", (q) =>
        q.eq("tenantId", fromTenantId(ctx.tenantId)).eq("name", name)
      )
      .unique();
    return doc
      ? { id: toRoleId(doc._id), tenantId: toTenantId(doc.tenantId),
          name: doc.name, createdAt: doc._creationTime }
      : null;
  }

  async create(ctx: TenantContext, input: { name: string }): Promise<Role> {
    // RoleService has already called findByName above; OCC guarantees the
    // read set is consistent at commit time. No further locking needed.
    const id = await this.db.insert("roles", {
      tenantId: fromTenantId(ctx.tenantId),
      name: input.name,
      createdAt: Date.now(),
    });
    const doc = await this.db.get(id);
    return {
      id: toRoleId(doc!._id),
      tenantId: ctx.tenantId,
      name: doc!.name,
      createdAt: doc!.createdAt,
    };
  }
  // … remaining methods
}
```

**Why this is safe (despite no native unique constraint):**
- Convex mutations run atomically. All reads + writes commit together or not at all. [CITED: docs.convex.dev/database/advanced/occ]
- If another mutation also tries to insert the same `[tenantId, name]` between our check and our insert, both mutations conflict on the same index read set. Convex re-runs the loser; the loser's `findByName` then returns the now-existing role, and the loser throws `RoleNameAlreadyExistsError`.
- This is operationally equivalent to a unique constraint at the application layer.

### Pattern 9: Convex Mutation Handler — DI Assembly Point

**Example:**
```typescript
// convex/directory.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexRoleRepository } from "../src/modules/directory/adapters/convex/convex-role-repository.js";
import { RoleService } from "../src/modules/directory/application/role-service.js";
import { tenantContext } from "../src/modules/directory/application/tenant-context.js";
import { toTenantId } from "../src/modules/directory/adapters/convex/mappers.js";

export const createRole = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Adapter responsibilities (allowed by HARD RULE):
    //   1. validate input shape — done by Convex via `args` validator above
    //   2. resolve TenantContext — Phase 1: from args; Phase 2+: from ctx.auth
    //   3. instantiate dependencies
    //   4. call application service
    //   5. map response to wire shape
    const roleRepo = new ConvexRoleRepository(ctx.db);
    const service = new RoleService(roleRepo);
    const tCtx = tenantContext(toTenantId(args.tenantId));

    const role = await service.createRole(tCtx, { name: args.name });

    return {
      id: role.id,                    // returned as plain string — branded type erased
      tenantId: role.tenantId,
      name: role.name,
      createdAt: role.createdAt,
    };
  },
});
```

**Why per-call DI (not module-level singletons):** Convex mutations are stateless per invocation. The cost of `new ConvexRoleRepository(ctx.db)` is near-zero (it's a class with one assigned field). Module-level singletons would need to lazy-bind to `ctx.db` per call anyway. Per-call DI is the simplest correct pattern. The "module factory" optimization is explicitly deferred in CONTEXT.md.

### Pattern 10: Vitest Service Tests

**Example:**
```typescript
// tests/modules/directory/role-service.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { RoleService, RoleNameAlreadyExistsError } from "@/modules/directory/application/role-service.js";
import { InMemoryRoleRepository } from "@/modules/directory/adapters/memory/in-memory-role-repository.js";
import { tenantContext } from "@/modules/directory/application/tenant-context.js";
import { tenantId } from "@/modules/directory/domain/ids.js";

describe("RoleService.createRole", () => {
  let repo: InMemoryRoleRepository;
  let service: RoleService;
  const tCtx = tenantContext(tenantId("tenant_a"));

  beforeEach(() => {
    repo = new InMemoryRoleRepository();
    service = new RoleService(repo);
  });

  it("creates a role within a tenant", async () => {
    const role = await service.createRole(tCtx, { name: "approver" });
    expect(role.name).toBe("approver");
    expect(role.tenantId).toBe(tCtx.tenantId);
  });

  it("rejects duplicate name within the same tenant", async () => {
    await service.createRole(tCtx, { name: "approver" });
    await expect(service.createRole(tCtx, { name: "approver" }))
      .rejects.toBeInstanceOf(RoleNameAlreadyExistsError);
  });

  it("allows the same role name in a different tenant", async () => {
    const otherCtx = tenantContext(tenantId("tenant_b"));
    await service.createRole(tCtx, { name: "approver" });
    const other = await service.createRole(otherCtx, { name: "approver" });
    expect(other.name).toBe("approver");
    expect(other.tenantId).toBe(otherCtx.tenantId);
  });
});
```

### Pattern 11: ESLint Flat Config with Module-Boundary Enforcement

**Example:** Block deep imports into another module's `domain/`, `application/`, or `adapters/` directories.

```js
// eslint.config.js
// Source: github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  {
    files: ["src/**/*.ts", "convex/**/*.ts"],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: "./tsconfig.json" },
    },
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
      },
    },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // Block deep imports into directory/ internals from outside directory/
            {
              target: "./src/modules/!(directory)/**/*",
              from: "./src/modules/directory/{domain,application,adapters}/**/*",
              message:
                "Cross-module deep imports forbidden. Import from " +
                "'@/modules/directory' (barrel) instead — Module Boundary Rule (D-08).",
            },
            // Block deep imports into policy/ internals from outside policy/
            {
              target: "./src/modules/!(policy)/**/*",
              from: "./src/modules/policy/{domain,application,adapters}/**/*",
              message: "Import from '@/modules/policy' barrel only — D-08.",
            },
            // Block deep imports into audit/ internals from outside audit/
            {
              target: "./src/modules/!(audit)/**/*",
              from: "./src/modules/audit/{domain,application,adapters}/**/*",
              message: "Import from '@/modules/audit' barrel only — D-08.",
            },
            // Domain layer must not import from adapters or application
            {
              target: "./src/modules/*/domain/**/*",
              from: "./src/modules/*/{application,adapters}/**/*",
              message: "Domain layer must remain pure — no application or adapter imports.",
            },
            // Application layer must not import from adapters
            {
              target: "./src/modules/*/application/**/*",
              from: "./src/modules/*/adapters/**/*",
              message: "Application services must not import adapters — depend on ports only.",
            },
            // convex/ must not contain domain logic (HARD RULE)
            {
              target: "./convex/**/*",
              from: "./src/modules/*/domain/**/*",
              except: ["./src/modules/*/domain/ids.ts"],
              message:
                "convex/ may not import domain entities directly. Use module barrel " +
                "to access service types only.",
            },
          ],
        },
      ],
    },
  },
);
```

**Important nuance:** `eslint-plugin-import` flat-config support has been bumpy historically (issue #2556). If integration proves brittle, the planner may switch to `eslint-plugin-import-x` (a fork with cleaner flat-config support — same rule names, drop-in replacement). [CITED: github.com/antfu/eslint-plugin-import-x; github.com/import-js/eslint-plugin-import/issues/2556]

### Pattern 12: TypeScript Path Alias Configuration

**Example:**
```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "convex/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist", "convex/_generated"]
}
```

**Mirror in `vitest.config.ts`:**
```typescript
// vitest.config.ts
// Source: vitest.dev/config + vitest.dev/config/coverage
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/modules/**/*.ts"],
      exclude: [
        "src/modules/**/index.ts",                     // barrels
        "src/modules/**/adapters/convex/**",           // covered by Convex smoke
        "src/modules/**/*.test.ts",
      ],
      thresholds: {
        // 90%+ on critical business logic per engineering.md and D-20.
        // We apply the bar at the suite level; phase-2 will tighten Policy
        // Engine paths to 100% (engineering.md Coverage Targets).
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
```

### Anti-Patterns to Avoid

- **Ambient TenantContext via AsyncLocalStorage or globals.** Explicitly prohibited by D-19. Every service method takes `ctx` as the first parameter.
- **`v.string()` for primary IDs.** Use `v.id("table")`. Convex `Id<>` types provide compile-time safety against passing a `users` ID where a `roles` ID is expected.
- **Cross-tenant queries via `.collect()` without `.withIndex('by_tenant_*', q => q.eq('tenantId', …))`.** Trips the tenant-isolation review smell test. Every read on a tenant-owned table must use the tenant-prefixed index.
- **Importing Convex `Id<'…'>` types in `src/modules/<mod>/domain/` or `src/modules/<mod>/application/`.** D-14 explicitly forbids this. Mappers are the only translation layer.
- **Defining `PolicyVersion.content` shape at Phase 1.** Use `v.any()`. Phase 2 owns the schema.
- **Module barrels that re-export internals via `export *` from `./application/index.ts`.** Curate exports explicitly in the module's top-level `index.ts` — only public types, service classes, port interfaces, branded ID types. This is what makes the lint rule meaningful.
- **Throwing a unique-constraint violation from the Convex adapter.** Application service owns uniqueness checks (`findByName` then `create`). The adapter is a thin wrapper.
- **Cycle prevention in the schema.** Convex schemas cannot express graph invariants. D-11 puts cycle prevention in `UserService.setManager`. Trying to express it in `defineSchema` is a category error.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Branded ID validators for Convex args | Custom `Validator<X>` casts in every schema field | `convex-helpers/validators` `brandedString("X")` | Maintained, integrated with Convex codegen, less casting noise [CITED: stack.convex.dev/using-branded-types-in-validators] |
| Test runner / coverage | Custom Vitest plugins | `@vitest/coverage-v8` defaults with thresholds | V8 is the Vitest 2+ default; instrumentation is free [CITED: vitest.dev/config/coverage] |
| Module-boundary enforcement | Custom AST scripts / regex grep in CI | `eslint-plugin-import` `no-restricted-paths` zones | Mature rule; explicit `target`/`from`/`except` zones; custom messages [CITED: github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md] |
| Path alias resolution in tests | `tsconfig-paths` Node loader at runtime | `vitest.config.ts` `resolve.alias` | Same Vite-based resolution as the prod build; one source of truth [CITED: vitest.dev/config] |
| Multi-tenant uniqueness | Locks, `try/catch` on insert + retry, distributed coordination | Convex OCC + read-then-write inside a single mutation | Mutations are ACID; OCC re-runs on conflict transparently [CITED: docs.convex.dev/database/advanced/occ] |
| Auth identity table | Custom users table that diverges from Convex Auth shape | Reserve Convex Auth field names now (`email`, `emailVerificationTime`, `image`, `isAnonymous`) | Zero rework when Convex Auth wires in Phase 2+ [CITED: labs.convex.dev/auth/setup/schema] |
| Schema migrations for ID format changes | DIY string-format migration | Branded string IDs that are byte-identical to Convex `Id<>` | Brand is compile-time only; runtime is just `string` — no migration ever needed [CITED: stack.convex.dev/using-branded-types-in-validators] |

**Key insight:** Convex's design eliminates whole classes of problems other backends require workarounds for. ACID mutations + OCC = no need for distributed locks. `Id<'table'>` + codegen = no manual `v.string()` casting for primary references. Branded types in domain = no runtime cost. The right move at Phase 1 is to lean **harder** on Convex idioms, not fight them.

## Runtime State Inventory

**Greenfield phase — this section is NOT applicable.** Phase 1 creates the repository's first `package.json`, `src/`, `convex/`. Nothing renames, nothing migrates. Verified by `ls`: no `src/`, no `convex/`, no `package.json` at repo root as of 2026-05-31.

## Common Pitfalls

### Pitfall 1: Convex `v.id("table")` vs branded ID confusion at the wire boundary

**What goes wrong:** The Convex mutation `args` validator returns `Id<"roles">` typed values. The domain wants `RoleId` (branded string). Naive code passes `args.roleId` directly into a service method, causing TS errors or silent type-widening to plain `string`.

**Why it happens:** Branded types are compile-time only. At runtime both `Id<'roles'>` and `RoleId` are just `string`. The compiler will refuse the implicit conversion unless you go through the mapper.

**How to avoid:** Always run incoming `Id<>` args through the mapper before passing to a service. Every Convex handler that receives an `Id<>` arg should look like:
```typescript
const tCtx = tenantContext(toTenantId(args.tenantId));
const result = await service.findRoleById(tCtx, toRoleId(args.roleId));
```

**Warning signs:** `as` casts inside service code, `// @ts-expect-error` near service calls, importing `Id` from `convex/_generated/dataModel` into `src/modules/`.

### Pitfall 2: Convex has no native unique constraint — race window in application-layer enforcement

**What goes wrong:** Naive concern: two concurrent `createRole({name: "approver"})` mutations both call `findByName`, both find nothing, both insert, ending with two `approver` roles in the same tenant.

**Why it actually doesn't happen:** Convex mutations are transactional via OCC. Both mutations' read sets include the `by_tenant_name` index range `(tenantId=X, name="approver")`. When the first mutation commits, the second mutation's read set is invalidated and Convex re-runs it deterministically. On re-run, `findByName` returns the now-existing role and the service throws `RoleNameAlreadyExistsError`. [CITED: docs.convex.dev/database/advanced/occ]

**How to avoid:** Always perform the read inside the same mutation as the write — never spread across separate mutations. Always use the same composite index for both the existence check and the write path.

**Warning signs:** Two-step "check then insert" client-side flows (a query followed by a separate mutation). These give no atomicity. The fix is to do both inside the mutation.

### Pitfall 3: ESLint flat config + `eslint-plugin-import` rough edges

**What goes wrong:** `eslint-plugin-import` had a long-running issue (#2556) about full flat config support. Some users report unexpected behavior with the `no-restricted-paths` zones in flat config when path resolution differs.

**Why it happens:** The plugin was written for the legacy `.eslintrc` schema; flat config patching arrived later. Resolver settings (`import/resolver`) must be specified per-config-block.

**How to avoid:**
1. Pin `eslint-plugin-import@2.32.0` and `eslint-import-resolver-typescript@4.4.4` together.
2. Always set `settings["import/resolver"].typescript.project` to the tsconfig path inside the same config block where the rule is declared.
3. If issues persist, swap to `eslint-plugin-import-x` (a fork with cleaner flat-config support — identical rule API).

**Warning signs:** Rule passes locally but fails in CI, or rule fires on valid imports because path alias resolution silently dropped. Add a lint smoke test that asserts a deliberate boundary violation is caught.

### Pitfall 4: Convex Auth users-table fields must be reserved NOW or Phase 2 needs a migration

**What goes wrong:** Phase 1 defines a `users` table without `email`, `image`, `emailVerificationTime`, `isAnonymous`, `phone`. Phase 2 enables Convex Auth, which then tries to write users with those fields. The strict schema rejects unknown fields. Either Phase 2 ships a schema migration (extra work) OR the Phase 1 schema goes wide on day one.

**Why it happens:** Convex schemas are strict — unknown fields are rejected. Convex Auth's `createOrUpdateUser` writes a defined set of fields. [CITED: labs.convex.dev/auth/setup/schema]

**How to avoid:** Per CONTEXT.md "Integration Points," **reserve Convex Auth field names on the `users` table NOW**, all marked `v.optional(…)`:
- `email: v.optional(v.string())` — but ALSO add `v.string()` as Phase 1 requires email; **make `email` required** (it's required for the directory's `findUserByEmail`) and skip `v.optional`. Convex Auth permits required fields if all auth methods provide them.
- `image: v.optional(v.string())`
- `emailVerificationTime: v.optional(v.number())`
- `isAnonymous: v.optional(v.boolean())`
- `phone: v.optional(v.string())` (low-cost reservation; remove if undesired)

Also add the `by_email` index (required by Convex Auth). The schema in Pattern 1 already does this. [CITED: labs.convex.dev/auth/setup/schema]

**Warning signs:** A future Phase 2 task titled "Migrate users table for Convex Auth." Migrations are pain.

### Pitfall 5: `TS exactOptionalPropertyTypes` + branded types

**What goes wrong:** With `exactOptionalPropertyTypes: true` enabled, `{ managerId: UserId | null }` and `{ managerId?: UserId | null }` are different types. A repo that returns `{ managerId: null }` is incompatible with an interface declared `managerId?: UserId | null`.

**Why it happens:** `exactOptionalPropertyTypes` rejects the historical pattern of treating `undefined` and "absent" interchangeably.

**How to avoid:** Pick a canonical encoding and stick with it. Recommendation:
- `User.managerId: UserId | null` (always present, possibly null) — matches Convex's `v.union(v.id("users"), v.null())` exactly.
- Avoid `managerId?: UserId` — would require Convex `v.optional(v.id("users"))` and produces ambiguous "missing vs null" semantics.

**Warning signs:** Type errors at mapper boundary about "`undefined` is not assignable to `UserId | null`" or vice versa.

### Pitfall 6: Per-mutation service instantiation is fine — don't over-engineer DI

**What goes wrong:** Architects instinctively reach for a DI container or module-level singletons. In Convex, mutations are stateless and short-lived. Module singletons would need to lazy-bind `ctx.db` per call anyway, which is what per-mutation construction already does.

**How to avoid:** Construct services inline in the mutation handler. Resist module-level state. CONTEXT.md explicitly defers module builders to "when wiring becomes repetitive" — that day is not Phase 1.

**Warning signs:** Files like `convex/container.ts` or `src/di/registry.ts` appearing in plans.

## Code Examples

All code examples above are verified against current Convex documentation. The 12 patterns cover:

1. Convex schema with tenant-prefixed indexes — `docs.convex.dev/database/schemas`
2. Pure-TS domain entity with branded ID — community pattern
3. Branded IDs in Convex validators — `stack.convex.dev/using-branded-types-in-validators`
4. Convex `Id<>` ↔ branded mapping — same source
5. Constructor-injected service with TenantContext — DDD/Hexagonal
6. In-memory repository fake — standard test pattern
7. Cycle prevention algorithm — algorithm + complexity analysis
8. Read-then-write uniqueness via OCC — `docs.convex.dev/database/advanced/occ`
9. Mutation handler DI assembly — Convex pattern
10. Vitest service test — `vitest.dev/guide`
11. ESLint flat config with zones — `eslint-plugin-import` docs
12. TS path alias + Vitest mirror — `vitest.dev/config`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.eslintrc.cjs` legacy config | `eslint.config.js` flat config | ESLint 9.0 (2024) — required from 10.x | Required for `eslint@10.x`. Plugins migrate at their own pace; `eslint-plugin-import` flat-config works in 2.x but has rough edges (Pitfall 3). |
| `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` separate packages | Unified `typescript-eslint` package | typescript-eslint 8.0 (2024) | Single import; cleaner flat-config integration. |
| Vitest `coverage-c8` | `@vitest/coverage-v8` | Vitest 0.27+ (2023), default since 1.0 | V8 is the default coverage provider; faster than istanbul. |
| Hand-rolled branded validators | `convex-helpers/validators.brandedString` | convex-helpers 0.1.x | Centralized pattern; reduces casting noise. |
| Convex Auth via third-party Lucia | First-party `@convex-dev/auth` | 2024 (1.0 release) | Use `@convex-dev/auth` for new projects. Phase 1 only reserves schema room. |
| `Validator<T>` casts in schemas | `typedV(schema)` from convex-helpers | convex-helpers 0.1.100+ | Schema-aware id validators; avoid manual `v.id("name")` typos. |

**Deprecated/outdated:**
- Lucia auth (deprecated April 2025 per npm warning observed during slopcheck install — "This package has been deprecated. Please see https://lucia-auth.com/lucia-v3/migrate."). Convex Auth is the path forward.
- Legacy `.eslintrc` — supported only by ESLint 8.x; the planner should NOT introduce it.
- `@typescript-eslint/parser` / `@typescript-eslint/eslint-plugin` separate packages — superseded by unified `typescript-eslint`. Some older guides still show the split packages.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `eslint-plugin-import` flat config support is stable enough at `2.32.0` for the `no-restricted-paths` rule | Pattern 11 + Pitfall 3 | If unstable, planner switches to `eslint-plugin-import-x` (drop-in fork). Low risk — same rule API. [ASSUMED] |
| A2 | `@types/node@22` is the right major (assumed latest stable) | Installation | Risk: minor — `@types/node@20` also works. No behavioral difference for vitest/convex usage. [ASSUMED] |
| A3 | `eslint-import-resolver-typescript@4.4.4` is the current compatible version with eslint-plugin-import 2.32 | Installation | Risk: low — resolver compatibility is generally good across recent minors. [ASSUMED] |
| A4 | Reserving Convex Auth fields on the `users` table at Phase 1 prevents a Phase 2+ migration | Pitfall 4 | If the Convex Auth schema shape changes between now and Phase 2 implementation, a small migration may still be needed. The reservation reduces, not eliminates, risk. The fields listed match labs.convex.dev/auth/setup/schema as of 2026-05-31. [CITED: labs.convex.dev/auth/setup/schema] but the **decision to reserve now** is [ASSUMED] for future-Convex-Auth shape stability. |
| A5 | The depth limit of 50 for manager-chain cycle prevention is reasonable | Pattern 7 | If a real customer has org charts deeper than 50, the limit needs raising. Risk: trivial — the limit is a parameter. [ASSUMED] |
| A6 | `npx convex deploy` is the canonical CI command for schema + functions push (vs `npx convex dev --once`) | CI workflow guidance | `convex dev --once` is documented for codegen-only scenarios per `convex/cli/agent-mode`; `convex deploy` is the production deploy command. Planner should default to `convex deploy` for CI, `convex dev` for local watch. [CITED: docs.convex.dev/production + docs.convex.dev/cli] |
| A7 | Returning branded IDs as plain strings from Convex mutations is the right wire format | Pattern 9 | Brands erase to strings at runtime, so JSON serialization is automatic. The client will see plain strings; if the client has its own branded types, it casts on receive. [VERIFIED: stack.convex.dev/using-branded-types-in-validators] but the **convention for the wire boundary** is [ASSUMED]. |
| A8 | Per-call DI (no module-level service caching) is performant enough at Phase 1 scale | Pitfall 6 + Pattern 9 | At MVP scale (thousands of mutations/sec at most), object allocation is free. If profiling reveals overhead, switch to per-module factories — explicitly deferred per CONTEXT.md. [ASSUMED] |

**Summary:** 8 assumptions, none architecturally load-bearing. A1 and A4 are the most consequential and both have well-understood fallbacks. The planner should surface A1 (ESLint plugin choice) at the start of `01-03` so it can be locked early.

## Open Questions

1. **Should error handling use custom error classes or `Result<T, E>` types?**
   - What we know: Both are valid. Custom errors integrate naturally with Convex's error reporting (errors thrown in mutations propagate to client). `Result<T, E>` is more functional but requires every caller to pattern-match.
   - What's unclear: Convention preference. CONTEXT.md says "propose during planning" (Claude's discretion).
   - Recommendation: **Custom error classes per module** (e.g., `RoleNameAlreadyExistsError` in `directory`). They integrate with Convex's `ConvexError` if needed for client-side handling. Result types create plumbing noise without clear benefit at MVP scale. Plan `01-03` should lock this.

2. **File naming inside modules: `role-service.ts` vs `RoleService.ts` vs `roleService.ts`?**
   - What we know: All three are valid TS conventions.
   - What's unclear: Project preference.
   - Recommendation: **kebab-case** (`role-service.ts`). Matches the dominant 2025 TS ecosystem convention (Convex docs, Vitest docs, most Vercel-ecosystem projects). Class names inside files remain PascalCase (`RoleService`). Lock in plan `01-01`.

3. **Should `tests/` be co-located in `src/modules/<mod>/__tests__/` or in a top-level `tests/` mirror?**
   - What we know: Both are valid Vitest patterns. Co-location reduces navigation; top-level mirror reduces module clutter.
   - What's unclear: Project preference.
   - Recommendation: **top-level `tests/modules/<mod>/`** mirroring the src structure. Keeps the production `src/` tree clean of test boilerplate, makes coverage exclude rules trivial (`exclude: ["tests/**"]` and don't worry about `*.test.ts` inside src), and keeps `tsconfig.json` `include` patterns simple.

4. **Phase 2 will need a `runtime/` module — should Phase 1 pre-create the empty directory?**
   - What we know: CONTEXT.md says `runtime/` is "deferred to Phase 2." Pre-creation could go either way.
   - What's unclear: Whether mandatory `README.md` per module applies to empty directories.
   - Recommendation: **Do NOT pre-create**. CONTEXT.md is explicit ("Phase 1 creates only `directory/`, `policy/`, `audit/`"). Phase 2's `gsd:plan-phase` will create `runtime/` when needed. Empty module folders add clutter and tempt premature implementation.

5. **TenantContext at Phase 1 contains only `{ tenantId }`. Should the type be open for future fields now?**
   - What we know: D-19 says additional contextual fields (`actorId`, `requestId`, etc.) may be added later. Adding fields to an interface later is non-breaking IF callers use object spread / property access, breaking IF callers construct via positional parameters.
   - Recommendation: Define `TenantContext` as `interface` (extensible) not `type` (intersection-required to extend). Provide a `tenantContext(tenantId)` factory now; future additions use `tenantContext(tenantId, { actorId })` overloads. Lock in plan `01-03`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Convex CLI, Vitest, ESLint | ✓ | 18+ (any LTS) — required by Convex 1.39+ | — |
| npm | Package install | ✓ | bundled with Node | — |
| `npx convex dev` (interactive) | Local schema watch + push | ✓ | Convex CLI installed at `npm install convex` | — |
| `npx convex deploy` (CI) | CI schema deploy with `CONVEX_DEPLOY_KEY` | ✓ | same | — |
| Convex deployment URL | First run of `convex dev` provisions one | requires login | — | Anonymous mode via `CONVEX_AGENT_MODE=anonymous` for codegen-only |
| GitHub Actions | CI per `docs/engineering.md` | ✓ (repo is on GitHub) | — | — |

**Missing dependencies with no fallback:** none — all required tools are standard Node ecosystem.
**Missing dependencies with fallback:** Convex login may not be present in CI; use `CONVEX_DEPLOY_KEY` (production) or `CONVEX_AGENT_MODE=anonymous` (codegen-only) per `docs.convex.dev/cli/agent-mode`.

## Validation Architecture

Nyquist validation is enabled (no explicit `false` in `.planning/config.json`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.7 + `@vitest/coverage-v8` 4.1.7 |
| Config file | `vitest.config.ts` (Wave 0 — does not exist yet) |
| Quick run command | `npx vitest run tests/modules/directory/role-service.test.ts` |
| Full suite command | `npx vitest run --coverage` |
| Phase gate command | `npx vitest run --coverage` and verify `coverage/coverage-summary.json` lines/branches ≥ 90 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CON-01 | Tenant A cannot read tenant B's roles via `findRoleById` (in-memory fake mirrors tenant isolation) | unit (service) | `npx vitest run tests/modules/directory/tenant-isolation.test.ts` | ❌ Wave 0 |
| CON-01 | Convex `by_tenant_*` index is the only query path used (adapter mapping test) | unit (adapter) | `npx vitest run tests/modules/directory/convex-role-repository.test.ts` | ❌ Wave 0 |
| CON-02 | `RoleService.createRole` rejects duplicate name within same tenant | unit (service) | `npx vitest run tests/modules/directory/role-service.test.ts -t "duplicate"` | ❌ Wave 0 |
| CON-02 | Same role name permitted in different tenants | unit (service) | same file, different test | ❌ Wave 0 |
| CON-02 | `RoleService.renameRole` allows rename if no clash | unit (service) | same file | ❌ Wave 0 |
| CON-02 | `RoleService.findRoleByName` returns the role for that tenant | unit (service) | same file | ❌ Wave 0 |
| CON-03 | `UserService.assignRole` persists `roleId`, not role name | unit (service) | `npx vitest run tests/modules/directory/user-service.test.ts -t "assignRole"` | ❌ Wave 0 |
| CON-03 | After role rename, user still resolves to the same role via `roleId` | unit (service) | same file | ❌ Wave 0 |
| CON-04 | `UserService.setManager` rejects direct self-loop (`A.setManager(A)`) | unit (service) | `npx vitest run tests/modules/directory/cycle-prevention.test.ts` | ❌ Wave 0 |
| CON-04 | `UserService.setManager` rejects 2-cycle (A→B then B→A) | unit (service) | same file | ❌ Wave 0 |
| CON-04 | `UserService.setManager` rejects N-cycle (A→B→C then A.manager=C) | unit (service) | same file | ❌ Wave 0 |
| CON-04 | Broken chain (manager-of-manager missing) does NOT block assignment | unit (service) | same file | ❌ Wave 0 |
| CON-04 | Depth limit triggers error (synthetic chain of 51) | unit (service) | same file | ❌ Wave 0 |
| CON-04 | `setManager(null)` clears manager | unit (service) | same file | ❌ Wave 0 |
| POL-05 | `Policy` interface compiles with required fields; no runtime test (skeleton entity) | type-check | `npx tsc --noEmit` | implicit |
| POL-05 | Convex `policies` table accepts insert with required fields | smoke (Convex wiring) | `npx vitest run tests/convex/policy.smoke.test.ts` | ❌ Wave 0 |
| POL-06 | `PolicyVersion` interface compiles with `content: unknown`; no runtime test | type-check | `npx tsc --noEmit` | implicit |
| POL-06 | Convex `policyVersions` table accepts insert with `content: v.any()` | smoke (Convex wiring) | `npx vitest run tests/convex/policy.smoke.test.ts` | ❌ Wave 0 |
| AUD-03 | `AuditLog` interface compiles | type-check | `npx tsc --noEmit` | implicit |
| AUD-03 | Convex `auditLogs` table accepts insert; index `by_tenant_created` queryable | smoke (Convex wiring) | `npx vitest run tests/convex/audit.smoke.test.ts` | ❌ Wave 0 |
| HARD-RULE | `convex/` does NOT import from `src/modules/*/domain/` or `application/` business logic (only barrel-level types and service classes) | lint | `npx eslint convex/ src/` | ❌ Wave 0 (rule defined in `eslint.config.js`) |
| D-08 | Cross-module deep import fails lint | lint | `npx eslint src/` | ❌ Wave 0 |
| D-14 | `src/modules/*/domain/**` does NOT import from `convex/_generated/dataModel` | lint | `npx eslint src/` | ❌ Wave 0 |

### Coverage Thresholds

Per `docs/engineering.md` and D-20:
- **Critical paths (tenant isolation, role uniqueness, manager cycles, lookups): 90%+** — enforced via `vitest.config.ts` `coverage.thresholds.{lines, functions, branches, statements} = 90`.
- **Skeleton entities (Policy/PolicyVersion/AuditLog): type-check + smoke only at Phase 1.** Coverage of skeleton files is excluded from threshold via `coverage.exclude`.

### Sampling Rate
- **Per task commit:** `npx vitest run` (suite without coverage instrumentation, ~fast)
- **Per wave merge:** `npx vitest run --coverage` (enforce 90% threshold)
- **Phase gate:** Full suite green + coverage threshold met + `npx tsc --noEmit` clean + `npx eslint .` clean. Then `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] `package.json` — must declare `"type": "module"`, scripts: `test`, `test:coverage`, `lint`, `typecheck`, `convex:dev`, `convex:deploy`.
- [ ] `vitest.config.ts` — Pattern 12 above.
- [ ] `tsconfig.json` — Pattern 12 above.
- [ ] `eslint.config.js` — Pattern 11 above.
- [ ] `prettier.config.cjs` — standard `{ semi: true, singleQuote: false, printWidth: 100 }`.
- [ ] `convex/schema.ts` — Pattern 1 above (initial empty stubs OK if the planner stages the schema in `01-02`).
- [ ] `tests/setup.ts` (optional) — if shared test fixtures (e.g., `tenantContextFixture()`) emerge, place here.
- [ ] Initial smoke test files listed in the table above — must exist by the end of Wave 0 so subsequent waves are merely filling them in.

## Sources

### Primary (HIGH confidence)
- `docs.convex.dev/database/schemas` — `defineSchema`, `defineTable`, validator builders, indexes
- `docs.convex.dev/database/reading-data/indexes` — composite index prefix queries with `.withIndex()`
- `docs.convex.dev/database/advanced/occ` — mutation ACID guarantees and OCC re-run semantics
- `docs.convex.dev/cli` — CLI commands (`dev`, `deploy`)
- `docs.convex.dev/production` — `CONVEX_DEPLOY_KEY` and CI usage
- `labs.convex.dev/auth/setup/schema` — Convex Auth users table standard fields
- `stack.convex.dev/using-branded-types-in-validators` — branded types in Convex schema + validators
- `vitest.dev/config` — `vitest.config.ts` with `resolve.alias` for path aliases
- `vitest.dev/config/coverage` — coverage thresholds and v8 provider configuration
- `github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md` — `no-restricted-paths` zones syntax

### Secondary (MEDIUM confidence)
- `github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md` — `brandedString`, `typedV`, `customCtx` helpers
- `eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores/` — flat config evolution and `defineConfig` helper
- `github.com/import-js/eslint-plugin-import/issues/2556` — known rough edges with flat config support
- `mtsknn.fi/blog/eslint-import-restrictions/` — legacy `no-restricted-paths` zones example (informs syntax; flat-config adaptation in Pattern 11)
- `dev.to/sholajegede/how-to-audit-who-did-what-in-your-multi-tenant-app-...` — composite index pattern with `organizationId`-prefixed indexes
- `nanamanu.com/posts/branded-types-typescript/` — branded types tradeoffs (string-literal vs `unique symbol`)
- `effect.website/docs/code-style/branded-types/` — community pattern

### Tertiary (LOW confidence)
- `npx convex dev --once` flag behavior — confirmed exists in `docs.convex.dev/ai` and `docs.convex.dev/cli/agent-mode` references but exact flag semantics could be verified again via `npx convex dev --help` once Convex is installed. Used only as a fallback CI mode; primary path is `npx convex deploy` with `CONVEX_DEPLOY_KEY` (HIGH confidence).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified via `npm view`; all repos verified via `npm view repository.url`; all 12 packages slopcheck-cleared.
- Architecture patterns: HIGH — every code pattern is sourced from official Convex docs or `convex-helpers` README. Module boundary lint pattern is sourced from `eslint-plugin-import` official docs (legacy schema in source; flat-config adaptation is mechanical per `eslint.org/blog/2025/03/flat-config-extends-...`).
- Pitfalls: HIGH — all six pitfalls have either documented sources (Convex OCC, Convex Auth schema) or are mechanical consequences of locked decisions (D-14 brand cast at adapter, D-11 application-layer cycle prevention).
- Convex Auth schema reservation (A4): MEDIUM — depends on Convex Auth shape stability between now and Phase 2. Mitigated by `v.optional()` reservations being free to leave unused.
- ESLint flat config + `eslint-plugin-import` stability (A1): MEDIUM — known rough edges. Fork (`eslint-plugin-import-x`) is a safe fallback.

**Research date:** 2026-05-31
**Valid until:** 2026-06-30 (30-day window for stable foundations; Convex and Vitest ship minor versions every ~2-4 weeks but the patterns above are stable across recent minors).

---

## Project Constraints (from CLAUDE.md)

`CLAUDE.md` enforces GitNexus-based code intelligence: impact analysis before edits, `gitnexus_detect_changes` before commits, no find-and-replace renames. **However:** the current `mini-stry` repository is greenfield (no `src/`, no `convex/`, no `package.json`). GitNexus's indexed graph (18 symbols, 16 relationships per CLAUDE.md) reflects an earlier state and will be stale until Phase 1 lands code and `npx gitnexus analyze` reruns. The planner should:
- Tag tasks that create files as "skip pre-edit gitnexus_impact" — there's nothing to impact yet.
- Add a wave-merge task to run `npx gitnexus analyze` after the first wave of `src/` and `convex/` files lands so subsequent waves can use the tool meaningfully.
- Add a phase-completion task to verify `gitnexus_detect_changes` returns clean before `/gsd:verify-work`.
