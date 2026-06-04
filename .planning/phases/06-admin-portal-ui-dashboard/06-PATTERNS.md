# Phase 6: Admin Portal & UI Dashboard - Pattern Map

**Mapped:** 2026-06-04
**Files analyzed:** 18 new/modified files (backend) + the greenfield `web/` frontend
**Analogs found:** 14 / 18 (all backend files have strong analogs; the React frontend is greenfield — no in-repo analog, use RESEARCH.md patterns)

> Scope note: Phase 6 backend work is almost entirely **additive exposure** of existing behavior. The new code is narrow: (1) list/read methods on existing ports+adapters, (2) thin Convex handlers, (3) one runtime barrel export, (4) an idempotent seed. The `web/` React app is greenfield with no in-repo analog. Per the Convex HARD RULE (D-61), no domain logic enters `convex/` — query mechanics go in the **adapter**, business logic stays in `src/modules/*/application`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `convex/policy.ts` (stub → handlers) | route (thin handler) | request-response / CRUD | `convex/request.ts` + `convex/directory.ts` | exact |
| `convex/audit.ts` (stub → handler) | route (thin handler) | request-response (read) | `convex/request.ts` `getRequestEvaluation` | exact |
| `convex/approval.ts` (NEW) | route (thin handler) | request-response / event-driven | `convex/request.ts` `submitRequest` (DI graph) | exact |
| `convex/request.ts` (+`listRequests`) | route (thin handler) | request-response (read) | `convex/request.ts` `getRequestEvaluation` (same file) | exact |
| `convex/seed.ts` (NEW) | config (bootstrap) | batch / write | `ConvexTenantRepository.create` + RESEARCH Pattern 6 | role-match |
| `src/modules/policy/ports/policy-repository.port.ts` (+`listByTenant`) | port (interface) | CRUD (read-list) | `findByRequestType` in same port | exact |
| `src/modules/policy/adapters/convex/convex-policy-repository.ts` (+`listByTenant`) | adapter | CRUD (read-list) | `findByRequestType` (same file) | exact |
| `src/modules/policy/ports/policy-version-repository.port.ts` (+`listByPolicy`) | port (interface) | CRUD (read-list) | `findDraftByPolicy` in same port | exact |
| `src/modules/policy/adapters/convex/convex-policy-version-repository.ts` (+`listByPolicy`) | adapter | CRUD (read-list) | `findDraftByPolicy` / `getNextVersionNumber` (same file) | exact |
| `src/modules/approval/ports/approval-task-repository.port.ts` (+`findByApprover`) | port (interface) | CRUD (read-list) | `findByChainId` in same port | exact |
| `src/modules/approval/adapters/convex/convex-approval-task-repository.ts` (+`findByApprover`) | adapter | CRUD (read-list) | `findByChainId` (same file) | exact |
| `src/modules/*/adapters/memory/*` (mirror new list methods) | adapter (test double) | CRUD (read-list) | `InMemoryApprovalTaskRepository.findByChainId` | exact |
| `src/modules/runtime/index.ts` (+schema export) | config (barrel) | — | existing export lines in same barrel | exact |
| `src/modules/*/index.ts` (re-export new ports/methods if needed) | config (barrel) | — | existing barrels | exact |
| `tests/modules/policy/*.test.ts` (extend) | test | unit (fake-db) | `convex-user-repository.test.ts` | exact |
| `tests/modules/approval/*.test.ts` (extend) | test | unit (fake-db) | `convex-user-repository.test.ts` | exact |
| `tests/modules/runtime/schema-parity.test.ts` (NEW) | test | unit | `schema-valid.test.ts` / `schema-invalid.test.ts` | role-match |
| `web/**` (entire React SPA) | component / provider / hook / store | request-response + pub-sub (reactive) | none in-repo (greenfield) | no analog |

---

## Pattern Assignments

### `convex/policy.ts` (thin handler: listPolicies, listVersions, saveDraft, publish, rollback)

**Analog:** `convex/request.ts` (DI assembly + service call) and `convex/directory.ts` (multi-handler file shape).

**HARD-RULE header — copy verbatim to the top of every new/filled handler file** (`convex/request.ts` lines 1-5):
```typescript
/**
 * convex/ HARD RULE:
 * Allowed: validate input shape, instantiate dependencies, call application services, map responses.
 * Forbidden: evaluate policies, enforce business rules, perform approval routing, contain domain logic.
 */
```

**Imports pattern** (`convex/request.ts` lines 6-30): import `query`/`mutation` from `./_generated/server.js`, `v` from `convex/values`, services + Convex adapters from `../src/modules/<mod>/index.js` (barrel) or deep `../src/modules/<mod>/adapters/convex/...js` (allowed for DI), and `tenantContext, tenantId, userId` from `../src/modules/directory/index.js`. **Note `.js` extensions on all relative imports** (ESM).

**Thin query pattern — copy from `convex/directory.ts` `getRole` (lines 34-42):**
```typescript
export const getRole = query({
  args: { tenantId: v.string(), roleId: v.string() },
  handler: async (ctx, args) => {
    const roleRepo = new ConvexRoleRepository(ctx.db);
    const roleService = new RoleService(roleRepo);
    const tCtx = tenantContext(tenantId(args.tenantId));
    return roleService.findRoleById(tCtx, roleId(args.roleId));
  },
});
```
For `listPolicies` the handler instantiates `new ConvexPolicyRepository(ctx.db)`, builds `tenantContext(tenantId(args.tenantId))`, and returns `repo.listByTenant(tCtx)` (the NEW adapter method — see below). **No filtering in the handler.**

**Publish/saveDraft/rollback mutations** wire `PolicyService` exactly as `convex/request.ts` builds it (lines 45-54):
```typescript
const policyDispatcher = new EventDispatcher<PolicyEventMap>();
const policyRepo = new ConvexPolicyRepository(ctx.db);
const versionRepo = new ConvexPolicyVersionRepository(ctx.db);
const policyValidator = new AjvSchemaValidator();
const policyService = new PolicyService(policyRepo, versionRepo, policyValidator, policyDispatcher);
```
Then call the matching service method (verified signatures, `src/modules/policy/application/policy-service.ts`):
- `saveDraft` → `policyService.saveDraft(tCtx, policyVersionId(args.versionId), args.content, args.expectedRevision)` (line 86) — note optimistic-concurrency `expectedRevision` arg.
- `publish` → `policyService.publishDraft(tCtx, policyVersionId(args.versionId))` (line 129) — server Ajv gate lives here (D-58), NOT in the handler.
- `rollback` → `policyService.rollback(tCtx, policyId(args.policyId), targetVersionId, userId(args.actorId))` (line 164) — creates a new draft pointing at the target; never mutates history (D-60).

**Wiring the audit subscriber for lifecycle events** (so publish/rollback are recorded): mirror `convex/request.ts` lines 41-43 (`new RequestAuditSubscriber(auditRepo, dispatcher)` side-effect) and lines 70-71 for the approval subscriber — attach a subscriber to `policyDispatcher` if lifecycle events must hit the audit timeline. Confirm at plan time which subscriber consumes `PolicyEventMap`.

---

### `convex/audit.ts` (thin handler: listAuditLogs)

**Analog:** `convex/request.ts` `getRequestEvaluation` (lines 95-105) — the minimal read handler.

**Full pattern (replace the `export {}` stub):**
```typescript
import { query } from "./_generated/server.js";
import { v } from "convex/values";
import { ConvexAuditLogRepository } from "../src/modules/audit/index.js";
import { tenantContext, tenantId } from "../src/modules/directory/index.js";

export const listAuditLogs = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    const repo = new ConvexAuditLogRepository(ctx.db);
    return repo.findByTenant(tenantContext(tenantId(args.tenantId)));
  },
});
```
`AuditLogRepositoryPort.findByTenant` **already exists** (`src/modules/audit/ports/audit-log-repository.port.ts` line 11; adapter at `convex-audit-log-repository.ts` lines 27-33, indexed on `by_tenant_created`). No new method needed — pure exposure.

---

### `convex/approval.ts` (NEW — thin handler: listInbox, approve, reject)

**Analog:** `convex/request.ts` `submitRequest` (lines 32-93) — the full approval DI graph is already assembled there; copy the relevant portion.

**DI graph for approve/reject** (copy `convex/request.ts` lines 65-80):
```typescript
const userRepo = new ConvexUserRepository(ctx.db);
const roleRepo = new ConvexRoleRepository(ctx.db);
const chainRepo = new ConvexApprovalChainRepository(ctx.db);
const taskRepo = new ConvexApprovalTaskRepository(ctx.db);
const auditRepo = new ConvexAuditLogRepository(ctx.db);
const evalRepo = new ConvexRequestEvaluationRepository(ctx.db);

const approvalDispatcher = new EventDispatcher<ApprovalEventMap>();
void new ApprovalAuditSubscriber(auditRepo, approvalDispatcher); // wired via constructor side-effect

const routingService = new ApprovalRoutingService(
  chainRepo, taskRepo, userRepo, roleRepo, evalRepo, approvalDispatcher,
);
```

**CRITICAL — actorId in TenantContext** (Pitfall 5, `approval-routing-service.ts` line 172 `if (ctx.actorId !== task.approverId) throw new UnauthorizedApproverError()`):
```typescript
const tCtx = tenantContext(tenantId(args.tenantId), userId(args.actorId)); // BOTH args
return routingService.act(tCtx, approvalTaskId(args.taskId), "APPROVE"); // or "REJECT"
```
`act` signature (verified, lines 158-162): `act(ctx, taskId, action: "APPROVE" | "REJECT"): Promise<void>`.

**listInbox query** uses the NEW `findByApprover` adapter method (below), thin like `audit.listAuditLogs`:
```typescript
export const listInbox = query({
  args: { tenantId: v.string(), actorId: v.string() },
  handler: async (ctx, args) => {
    const repo = new ConvexApprovalTaskRepository(ctx.db);
    const tCtx = tenantContext(tenantId(args.tenantId));
    return repo.findByApprover(tCtx, userId(args.actorId));
  },
});
```

---

### `convex/request.ts` — add `listRequests` query

**Analog:** `getRequestEvaluation` in the same file (lines 95-105). `RequestEvaluationRepositoryPort.findByTenant` already exists (port line 28; adapter `convex-request-evaluation-repository.ts` lines 47-53, indexed `by_tenant_created`). Add a thin query returning `evalRepo.findByTenant(tenantContext(tenantId(args.tenantId)))`. No new repo method needed.

---

### `src/modules/policy/adapters/convex/convex-policy-repository.ts` — add `listByTenant`

**Analog:** `findByRequestType` in the same file (lines 33-42) — the `withIndex` read pattern.

**Port addition** (`policy-repository.port.ts`, mirror existing method signatures — `ctx: TenantContext` first):
```typescript
listByTenant(ctx: TenantContext): Promise<Policy[]>;
```
**Adapter addition** (mirror `findByRequestType`; index `by_tenant_name` exists in `convex/schema.ts` line 52):
```typescript
async listByTenant(ctx: TenantContext): Promise<Policy[]> {
  const docs = await this.db
    .query("policies")
    .withIndex("by_tenant_name", (q) => q.eq("tenantId", fromTenantId(ctx.tenantId)))
    .collect();
  return docs.map(toPolicyDomain);
}
```
> RESEARCH note (Pattern 5 / Pitfall 3): per-tenant policy counts are bounded for the demo, but prefer `.order("desc").take(100)` over unbounded `.collect()` to follow Convex best practice. `toPolicyDomain` + `fromTenantId` are already imported in this file.

---

### `src/modules/policy/adapters/convex/convex-policy-version-repository.ts` — add `listByPolicy`

**Analog:** `findDraftByPolicy` (lines 49-60) and `getNextVersionNumber` (lines 101-114) in the same file — both query `policyVersions` with a `by_tenant_policy_*` index.

**Port addition** (`policy-version-repository.port.ts`):
```typescript
listByPolicy(ctx: TenantContext, policyId: PolicyId): Promise<PolicyVersion[]>;
```
**Adapter addition** (use `by_tenant_policy_version` index, `convex/schema.ts` line 70; mirror `getNextVersionNumber`'s `withIndex`):
```typescript
async listByPolicy(ctx: TenantContext, policyId: PolicyId): Promise<PolicyVersion[]> {
  const docs = await this.db
    .query("policyVersions")
    .withIndex("by_tenant_policy_version", (q) =>
      q.eq("tenantId", fromTenantId(ctx.tenantId)).eq("policyId", fromPolicyId(policyId)),
    )
    .collect();
  return docs.map(toPolicyVersionDomain);
}
```
Supports the Version History panel (D-60): published versions read-only, active highlighted, ordered by `versionNumber`.

---

### `src/modules/approval/adapters/convex/convex-approval-task-repository.ts` — add `findByApprover`

**Analog:** `findByChainId` in the same file (lines 43-51) — identical `withIndex(...).collect().map(toApprovalTaskDomain)` shape.

**Port addition** (`approval-task-repository.port.ts`):
```typescript
findByApprover(ctx: TenantContext, approverId: UserId): Promise<ApprovalTask[]>;
```
**Adapter addition** (index `by_tenant_approver` exists, `convex/schema.ts` line 116; `fromUserId` already imported):
```typescript
async findByApprover(ctx: TenantContext, approverId: UserId): Promise<ApprovalTask[]> {
  const docs = await this.db
    .query("approvalTasks")
    .withIndex("by_tenant_approver", (q) =>
      q.eq("tenantId", fromTenantId(ctx.tenantId)).eq("approverId", fromUserId(approverId)),
    )
    .collect();
  return docs.map(toApprovalTaskDomain);
}
```
Powers UI-03 Inbox (tasks for `actorId`, D-57 actor-scoping).

---

### Memory adapters — mirror each new list method

**Analog:** `InMemoryApprovalTaskRepository.findByChainId` (`in-memory-approval-task-repository.ts` lines 38-42):
```typescript
async findByChainId(ctx: TenantContext, id: ApprovalChainId): Promise<ApprovalTask[]> {
  return [...this.records.values()].filter((r) => r.tenantId === ctx.tenantId && r.chainId === id);
}
```
For each new port method, add the in-memory `Map`-filter equivalent (`findByApprover` filters on `approverId`; `listByTenant`/`listByPolicy` filter the policy maps). These keep the port interface satisfied by both adapters and are what the fake-db unit tests exercise (Convex adapters are coverage-excluded; memory + fake-db tests carry the quality bar).

---

### `src/modules/runtime/index.ts` — export the canonical schema (D-59)

**Analog:** existing export lines in the same barrel (lines 1-26 are all re-exports). Add one line (RESEARCH Pattern 4, step 1; `resolveJsonModule:true` already set):
```typescript
export { default as policyContentSchema } from "./schema/policy-content.schema.json" with { type: "json" };
```
Low blast radius (additive). The frontend Monaco setup and the Ajv validator must consume **this same artifact** (parity invariant, D-59). Fallback if the import-attribute friction appears in the Vite build: frontend imports the JSON by relative path (parity preserved — same file). Run `gitnexus_impact` on this barrel before editing (CLAUDE.md).

---

### Tests — `tests/modules/{policy,approval}/*.test.ts`, `tests/modules/runtime/schema-parity.test.ts`

**Analog (adapter unit test):** `tests/modules/directory/convex-user-repository.test.ts` (lines 1-40). Pattern: import the Convex adapter + `createFakeMutationDb`/`asMutationDb`/`asQueryDb` from `tests/_helpers/convex-ctx-fixture.ts`, mock `db.query(...).withIndex(...).collect()` chain, assert tenant scoping (tenant A never sees tenant B) and correct index args.

`convex-ctx-fixture.ts` helpers (verified): `createFakeMutationDb()` returns `{get,insert,patch,delete,query}` vi-mocks; `asQueryDb(fake)` casts for read-only query handlers.

**Analog (schema parity test):** model on `tests/modules/runtime/schema-valid.test.ts` + `schema-invalid.test.ts`. New `schema-parity.test.ts` asserts the barrel-exported `policyContentSchema` is the **same object** the Ajv validator loads, reusing the existing valid/invalid fixtures (highest-value new test per RESEARCH Wave 0).

---

### `convex/seed.ts` (NEW — idempotent demo seed, D-62)

**Analog:** `ConvexTenantRepository.create` (`convex-tenant-repository.ts` lines 10-18) for the raw `db.insert(...).get(...)` shape, plus RESEARCH Pattern 6 for the idempotency guard. Use `internalMutation` (not public):
```typescript
import { internalMutation } from "./_generated/server.js";
export const seedDemoData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("tenants").first();
    if (existing) return { seeded: false }; // idempotent guard
    // insert tenants → roles → users (managerId hierarchy) → policies → policyVersions
    //   → requestEvaluations → approvalChains → approvalTasks → auditLogs
    return { seeded: true };
  },
});
```
Seed may insert directly via `ctx.db` (bootstrap is exempt from the "call services" rule — it is environment setup, not a request path), OR reuse the Convex repositories/services for correctness. Prefer reusing repositories where the entity has invariants (users w/ manager hierarchy). Run via `npx convex run seed:seedDemoData`. The full demo flow must support the D-63 cross-user scenario.

---

### `web/**` (greenfield React SPA — NO in-repo analog)

There is no existing frontend in this repo (UI-SPEC "Greenfield note"). The planner must use **RESEARCH.md** as the pattern source, not a codebase analog:
- Project structure: RESEARCH "Recommended Project Structure" (separate `web/` Vite root, own `tsconfig` with `@/*`→`web/src/*`).
- `main.tsx` ConvexProvider: RESEARCH Pattern 1.
- Demo Context Selector → `{tenantId, actorId}` injected into every query/mutation: RESEARCH Pattern 2.
- Monaco schema feed (`setDiagnosticsOptions`, `fileMatch` must equal model URI): RESEARCH Pattern 4 + Pitfall 1.
- Reactive `useQuery`/`useMutation`: RESEARCH Pattern 5, D-63.
- Visual contract (colors/typography/spacing/copy): `06-UI-SPEC.md` is authoritative.

**The one cross-cutting tie to the backend:** every `useQuery`/`useMutation` call passes `{ tenantId, actorId }` args that the thin handlers above turn into `TenantContext` — this mirrors `convex/request.ts` `submitRequest` args exactly (`tenantId: v.string(), actorId: v.string()`).

---

## Shared Patterns

### TenantContext-first (every handler + every service method)
**Source:** `convex/directory.ts` line 29, `convex/request.ts` line 82, `src/modules/directory/index.ts` lines 8-10.
**Apply to:** Every new handler and every new port/adapter method.
```typescript
const tCtx = tenantContext(tenantId(args.tenantId));                 // read paths
const tCtx = tenantContext(tenantId(args.tenantId), userId(args.actorId)); // approval mutations (need actorId)
```
`tenantContext`, `tenantId`, `userId`, `roleId` all come from `../src/modules/directory/index.js`.

### Thin handler shape (HARD RULE, D-61)
**Source:** `convex/directory.ts` (whole file), `convex/request.ts` lines 95-105.
**Apply to:** All `convex/*.ts` handlers.
Handler body = parse args (`v.*`) → instantiate adapter(s) → assemble service via DI → build `TenantContext` → call service → return. **No `if`/branch/filter/transform/business logic** in the handler. Keep the HARD-RULE doc-comment header.

### Tenant-scoped indexed read (query mechanics live in the ADAPTER)
**Source:** `convex-policy-repository.ts` `findByRequestType` (lines 33-42), `convex-audit-log-repository.ts` `findByTenant` (lines 27-33), `convex-request-evaluation-repository.ts` `findByTenant` (lines 47-53).
**Apply to:** Every new list method.
```typescript
this.db.query("<table>").withIndex("by_tenant_<...>", (q) => q.eq("tenantId", fromTenantId(ctx.tenantId)) ...).collect()
```
Index selection + tenant scoping belong here, never in the handler. Prefer `.order("desc").take(n)` over unbounded `.collect()` for lists (RESEARCH Pattern 5).

### Subscriber wiring via constructor side-effect
**Source:** `convex/request.ts` lines 41-43 (`void new RequestAuditSubscriber(auditRepo, requestDispatcher)`) and lines 70-71.
**Apply to:** Any handler that must record audit events from emitted domain events (approval act, policy lifecycle).

### ESM `.js` import extensions + barrel-only cross-module imports
**Source:** all `src/modules/*` files and `convex/*.ts`.
**Apply to:** Every new file. Cross-module access via `@/modules/<mod>/index.js` barrels (ESLint `import/no-restricted-paths`); `convex/` may deep-import `./adapters/convex/**` for DI only.

### Adapter unit test via fake db
**Source:** `tests/modules/directory/convex-user-repository.test.ts` + `tests/_helpers/convex-ctx-fixture.ts`.
**Apply to:** Every new list adapter method (memory + fake-db). Assert tenant isolation and index args.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `web/**` (entire React SPA: routes, components, features/policy Monaco, DemoContext, lib/cn, hooks) | component / provider / hook / store | request-response + pub-sub (reactive) | No frontend exists in the repo. Greenfield per UI-SPEC. Use RESEARCH.md Patterns 1-6 + `06-UI-SPEC.md` (authoritative visual contract) instead of a codebase analog. |

Partial-analog files (have a backend shape to copy but a new flavor):
- `convex/seed.ts` — `db.insert` shape from `ConvexTenantRepository`; idempotency guard from RESEARCH Pattern 6 (no existing seed in repo).
- `tests/modules/runtime/schema-parity.test.ts` — structure from `schema-valid/invalid.test.ts`; the parity *assertion* (barrel object identity) is new.

---

## Metadata

**Analog search scope:** `convex/` (handlers, schema), `src/modules/{policy,approval,request,audit,directory,runtime}/{ports,adapters/convex,adapters/memory,application,index.ts}`, `tests/modules/**`, `tests/_helpers/**`.
**Files scanned:** ~28 source files read (handlers, ports, adapters, barrels, services, schema, one test, one fixture).
**Verified facts:** existing indexes `by_tenant_name` (policies), `by_tenant_policy_version` (policyVersions), `by_tenant_approver` (approvalTasks), `by_tenant_created` (auditLogs, requestEvaluations) all present in `convex/schema.ts`; `findByTenant` exists on audit + request ports; `ApprovalRoutingService.act(ctx, taskId, action)` and `PolicyService.{saveDraft,publishDraft,rollback}` signatures confirmed.
**Pattern extraction date:** 2026-06-04
