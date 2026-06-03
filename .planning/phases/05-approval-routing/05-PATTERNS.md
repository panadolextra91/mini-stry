# Phase 5: Approval Routing (Reference Decision Consumer) - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 30 (22 new, 8 modified)
**Analogs found:** 30 / 30 (every artifact has an exact in-repo template — confirms RESEARCH.md "~90% mechanical replication")

> Module name: this map assumes `src/modules/approval/` (RESEARCH A4 recommendation). If the planner chooses `routing/`, substitute the directory name throughout; every pattern is identical.

## File Classification

### New files

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/modules/approval/domain/ids.ts` | model (branded IDs) | transform | `src/modules/request/domain/ids.ts` | exact |
| `src/modules/approval/domain/approval-chain.ts` | model (entity) | transform | `src/modules/request/domain/request-evaluation.ts` | exact (role) |
| `src/modules/approval/domain/approval-task.ts` | model (entity) | transform | `src/modules/request/domain/request-evaluation.ts` | exact (role) |
| `src/modules/approval/domain/approval-status.ts` | model (string union) | transform | `src/modules/request/domain/request-evaluation-status.ts` | exact |
| `src/modules/approval/domain/approval-task-state.ts` | model (string union) | transform | `src/modules/request/domain/request-evaluation-status.ts` | exact |
| `src/modules/approval/domain/state-machine.ts` | domain (pure fns) | transform | *new logic* — pattern from RESEARCH Pattern 4; no direct analog | role-match (pure domain) |
| `src/modules/approval/domain/approval-events.ts` | model (event map) | event-driven | `src/modules/request/domain/request-events.ts` | exact |
| `src/modules/approval/application/approval-routing-service.ts` | service | event-driven + CRUD | `src/modules/request/application/policy-runtime-service.ts` + `directory/.../user-service.ts` (`setManager` walk) | exact (composite) |
| `src/modules/approval/application/errors.ts` | utility (error classes) | transform | `src/modules/directory/application/errors.ts` | exact |
| `src/modules/approval/ports/approval-chain-repository.port.ts` | port | CRUD | `src/modules/request/ports/request-evaluation-repository.port.ts` | exact |
| `src/modules/approval/ports/approval-task-repository.port.ts` | port | CRUD | `src/modules/request/ports/request-evaluation-repository.port.ts` | exact |
| `src/modules/approval/adapters/memory/in-memory-approval-chain-repository.ts` | adapter (fake) | CRUD | `src/modules/request/adapters/memory/in-memory-request-evaluation-repository.ts` | exact |
| `src/modules/approval/adapters/memory/in-memory-approval-task-repository.ts` | adapter (fake) | CRUD | `src/modules/request/adapters/memory/in-memory-request-evaluation-repository.ts` | exact |
| `src/modules/approval/adapters/convex/convex-approval-chain-repository.ts` | adapter | CRUD | `src/modules/request/adapters/convex/convex-request-evaluation-repository.ts` | exact |
| `src/modules/approval/adapters/convex/convex-approval-task-repository.ts` | adapter | CRUD | `src/modules/request/adapters/convex/convex-request-evaluation-repository.ts` | exact |
| `src/modules/approval/adapters/convex/mappers.ts` | adapter (mappers) | transform | `src/modules/request/adapters/convex/mappers.ts` + `directory/.../mappers.ts` | exact |
| `src/modules/approval/index.ts` | config (barrel) | — | `src/modules/request/index.ts` | exact |
| `src/modules/approval/README.md` | doc | — | `src/modules/request/README.md` | exact (role) |
| `convex/approval.ts` (or extend `convex/request.ts`) | config (thin DI) | event-driven | `convex/request.ts` | exact |
| `tests/modules/approval/routing-service.test.ts` | test | event-driven | `tests/modules/request/request-audit-subscriber.test.ts` | exact (role) |
| `tests/modules/approval/state-machine.test.ts` | test | transform | `tests/modules/request/request-audit-subscriber.test.ts` | role-match |
| `tests/modules/approval/approval-audit-subscriber.test.ts` | test | event-driven | `tests/modules/request/request-audit-subscriber.test.ts` | exact |

### Modified files

| Modified File | Role | Change | Analog / Pattern To Extend | Match Quality |
|---------------|------|--------|----------------------------|---------------|
| `src/shared/event-dispatcher.ts` | utility (event bus) | D-54 per-handler try/catch | its own `emit` loop (lines 23-30) | self |
| `src/modules/request/application/policy-runtime-service.ts` | service | D-48 thread `ctx.actorId → requesterId` | its own `submit` create calls (lines 51-60, 72-81) | self |
| `src/modules/request/domain/request-evaluation.ts` | model | D-47 add `requesterId: UserId \| null` | its own interface (lines 7-19) | self |
| `src/modules/request/ports/request-evaluation-repository.port.ts` | port | add `requesterId` to `CreateRequestEvaluationInput` | its own input (lines 8-17) | self |
| `src/modules/request/adapters/memory/in-memory-request-evaluation-repository.ts` | adapter (fake) | persist `requesterId` | its own `create` (lines 11-28) | self |
| `src/modules/request/adapters/convex/{convex-request-evaluation-repository,mappers}.ts` | adapter | persist + map `requesterId` | its own insert/mapper | self |
| `convex/schema.ts` | config | add `requesterId` col + `approvalChains`/`approvalTasks` tables | `requestEvaluations` table (lines 80-93) | self |
| `src/modules/directory/application/tenant-context.ts` (+ `directory/index.ts`) | model + barrel | D-48 add optional `actorId?: UserId` | its own interface + factory (lines 8-12) | self |
| `src/modules/audit/application/audit-event-subscriber.ts` (or new `approval-audit-subscriber.ts`) (+ `audit/index.ts`) | service (subscriber) | D-53/D-54 `approval.*` handlers | `request-audit-subscriber.ts` (lines 13-53) | exact |
| `eslint.config.js` | config | D-08 add `approval` zone | request zone (lines 51-55) | self |
| `tests/_helpers/in-memory-fakes.ts` | test helper | add `setupApproval` / extend `setupRequest` | `setupRequest` (lines 42-65) | self |

## Pattern Assignments

### `src/modules/approval/domain/ids.ts` (model, transform)

**Analog:** `src/modules/request/domain/ids.ts` (whole file) + `directory/domain/ids.ts` (multi-ID file shape).

Copy the branded-string + factory pattern verbatim, two IDs:
```typescript
export type ApprovalChainId = string & { readonly __brand: "ApprovalChainId" };
export type ApprovalTaskId  = string & { readonly __brand: "ApprovalTaskId" };

export const approvalChainId = (raw: string): ApprovalChainId => raw as ApprovalChainId;
export const approvalTaskId  = (raw: string): ApprovalTaskId  => raw as ApprovalTaskId;
```
Factory functions are used ONLY at adapter mapper boundaries (per `directory/domain/ids.ts` lines 1-5 doc comment).

---

### `src/modules/approval/domain/approval-status.ts` + `approval-task-state.ts` (model, string union)

**Analog:** `src/modules/request/domain/request-evaluation-status.ts` (the entire file is one line):
```typescript
export type RequestEvaluationStatus = "completed" | "failed";
```
Mirror as:
```typescript
// approval-status.ts        (ApprovalChain.status)
export type ChainStatus = "IN_PROGRESS" | "APPROVED" | "REJECTED";
// approval-task-state.ts    (ApprovalTask.state)
export type TaskState   = "PENDING" | "APPROVED" | "REJECTED";
```

---

### `src/modules/approval/domain/approval-chain.ts` + `approval-task.ts` (model, entity)

**Analog:** `src/modules/request/domain/request-evaluation.ts` (lines 1-19) — plain `readonly` TS interface (D-13), `.js` type-only imports, branded IDs from `./ids.js`, cross-module IDs from barrels.

Import shape to copy (lines 1-5 of the analog):
```typescript
import type { TenantId, UserId, RoleId } from "@/modules/directory/index.js";
import type { RequestEvaluationId } from "@/modules/request/index.js"; // barrel, NOT deep import (D-08)
import type { ApprovalChainId, ApprovalTaskId } from "./ids.js";
import type { ChainStatus } from "./approval-status.js";
import type { TaskState } from "./approval-task-state.js";
```
Entities (fields fixed by D-46):
```typescript
export interface ApprovalChain {
  readonly id: ApprovalChainId;
  readonly tenantId: TenantId;
  readonly requestEvaluationId: RequestEvaluationId;
  readonly status: ChainStatus;
  readonly createdAt: number;
}
export interface ApprovalTask {
  readonly id: ApprovalTaskId;
  readonly tenantId: TenantId;
  readonly chainId: ApprovalChainId;
  readonly stageNumber: number;     // always 1 in Phase 5
  readonly approverId: UserId;      // resolved snapshot (D-44)
  readonly approverRoleId: RoleId;  // resolved snapshot
  readonly state: TaskState;
  readonly createdAt: number;
}
```
Note: `tenantId` is on every entity in this codebase (see `request-evaluation.ts` line 9, `user.ts` line 3) even though D-46 omits it — keep it for tenant scoping (CON-01).

---

### `src/modules/approval/domain/approval-events.ts` (model, event-driven)

**Analog:** `src/modules/request/domain/request-events.ts` (whole file, lines 1-29) — per-event `readonly` interfaces + a `*EventMap` type alias keyed by event-name string.

Copy the structure exactly:
```typescript
import type { TenantId, UserId } from "@/modules/directory/index.js";
import type { RequestEvaluationId } from "@/modules/request/index.js";
import type { ApprovalChainId, ApprovalTaskId } from "./ids.js";

export interface ApprovalTaskApprovedEvent {
  readonly tenantId: TenantId;
  readonly taskId: ApprovalTaskId;
  readonly chainId: ApprovalChainId;
  readonly actorId: UserId;
  readonly timestamp: number;
}
// ApprovalTaskRejectedEvent — identical shape
// ApprovalRoutingFailedEvent — { tenantId, evaluationRecordId: RequestEvaluationId, reason: string, timestamp }

export type ApprovalEventMap = {
  ApprovalTaskApproved: ApprovalTaskApprovedEvent;
  ApprovalTaskRejected: ApprovalTaskRejectedEvent;
  ApprovalRoutingFailed: ApprovalRoutingFailedEvent;
};
```

---

### `src/modules/approval/domain/state-machine.ts` (domain, pure transform) — NEW LOGIC

No direct analog (no existing module has a transition-function file). Follow RESEARCH Pattern 4. Pure deterministic functions, 100% coverage target (`docs/engineering.md` "Approval Workflow Generation: 100%"). Guards (terminal-state / chain derivation) per D-51:
```typescript
export function transitionTask(state: TaskState, action: "APPROVE" | "REJECT"): TaskState {
  if (state !== "PENDING") throw new TaskAlreadyResolvedError(/* taskId */);
  return action === "APPROVE" ? "APPROVED" : "REJECTED";
}
export function deriveChainStatus(taskStates: readonly TaskState[]): ChainStatus {
  if (taskStates.some((s) => s === "REJECTED")) return "REJECTED";
  if (taskStates.every((s) => s === "APPROVED")) return "APPROVED";
  return "IN_PROGRESS";
}
```
Errors imported from `../application/errors.js` (matches the domain→application boundary rule; note `state-machine.ts` lives in `domain/` but ESLint zone lines 56-59 forbid domain importing application — the planner must put the throw in the **service** `act()` instead, keeping `transitionTask` returning a value or throwing a domain-local error. Flag: define `TaskAlreadyResolvedError` so it does not violate the domain-purity zone, or perform the guard in `application/approval-routing-service.ts`).

---

### `src/modules/approval/application/errors.ts` (utility, error classes)

**Analog:** `src/modules/directory/application/errors.ts` (lines 1-43) — each error `extends Error`, sets `this.name`, captures a `public readonly` field, builds a tenant-scoped message.

Copy this exact class shape (from analog lines 17-22):
```typescript
export class RoutingError extends Error {
  constructor(public readonly requesterId: UserId, public readonly targetRoleId: RoleId) {
    super(`No ancestor of ${requesterId} holds role ${targetRoleId} — routing failed`);
    this.name = "RoutingError";
  }
}
```
Define: `RoutingError`, `HierarchyTraversalError`, `TaskAlreadyResolvedError`, `UnauthorizedApproverError`.
**`RoleNotFoundError`:** reuse the directory barrel export (`directory/application/errors.ts` lines 17-22, already exported from `directory/index.ts` line 16, takes a `RoleId`) per RESEARCH A2 — do NOT redefine.

---

### `src/modules/approval/ports/*.port.ts` (port, CRUD)

**Analog:** `src/modules/request/ports/request-evaluation-repository.port.ts` (lines 1-23). Every method takes `ctx: TenantContext` first (D-19); a `CreateXInput` interface precedes the port; `findById` returns `... | null`.

`ApprovalChainRepositoryPort`:
```typescript
import type { TenantContext } from "@/modules/directory/index.js";
import type { RequestEvaluationId } from "@/modules/request/index.js";
import type { ApprovalChainId } from "../domain/ids.js";
import type { ApprovalChain } from "../domain/approval-chain.js";
import type { ChainStatus } from "../domain/approval-status.js";

export interface CreateApprovalChainInput {
  readonly requestEvaluationId: RequestEvaluationId;
  readonly status: ChainStatus;
}
export interface ApprovalChainRepositoryPort {
  create(ctx: TenantContext, input: CreateApprovalChainInput): Promise<ApprovalChain>;
  findById(ctx: TenantContext, id: ApprovalChainId): Promise<ApprovalChain | null>;
  findByRequestEvaluationId(ctx: TenantContext, id: RequestEvaluationId): Promise<ApprovalChain | null>; // reverse lookup + idempotency (Pitfall 5)
  updateStatus(ctx: TenantContext, id: ApprovalChainId, status: ChainStatus): Promise<ApprovalChain>;
}
```
`ApprovalTaskRepositoryPort`: `create` / `findById` / `findByChainId` / `updateState`. Same `ctx`-first shape.

---

### `src/modules/approval/adapters/memory/*.ts` (adapter, fake — D-20)

**Analog:** `src/modules/request/adapters/memory/in-memory-request-evaluation-repository.ts` (whole file, lines 1-40).

Copy verbatim: `Map<Id, Entity>` store, `idCounter` for deterministic IDs (`buildApprovalChainId(\`chain_${this.idCounter++}\`)`), and the **tenant-scoping guard** in every read (analog lines 32-34):
```typescript
async findById(ctx: TenantContext, id: ApprovalChainId): Promise<ApprovalChain | null> {
  const record = this.records.get(id);
  if (!record) return null;
  if (record.tenantId !== ctx.tenantId) return null; // tenant scoping (CON-01)
  return record;
}
```
Add `updateStatus`/`updateState` that read-then-rewrite the map entry (immutable replacement).

---

### `src/modules/approval/adapters/convex/convex-*-repository.ts` (adapter, CRUD)

**Analog:** `src/modules/request/adapters/convex/convex-request-evaluation-repository.ts` (whole file, lines 1-46).

Copy: constructor takes `db: MutationCtx["db"] | QueryCtx["db"]` (line 11); `create` guards `if (!('insert' in this.db))` (line 14); insert maps branded IDs via `fromX` mappers; re-`get` the doc and run `toXDomain`; `findById` applies the **tenant guard** `if (doc.tenantId !== fromTenantId(ctx.tenantId)) return null` (line 35); list reads use `.withIndex("by_tenant_...", q => q.eq("tenantId", fromTenantId(ctx.tenantId)))` (lines 40-43).

For `findByRequestEvaluationId` use the new reverse-lookup index `by_tenant_request_evaluation`; for tasks-by-chain use `by_tenant_chain`.

---

### `src/modules/approval/adapters/convex/mappers.ts` (adapter, transform)

**Analog:** `src/modules/request/adapters/convex/mappers.ts` (lines 1-29) for `toX/fromX` ID + entity mapper; `directory/adapters/convex/mappers.ts` (lines 7-15, 31-43) for the multi-ID file + `doc.x ? toId(doc.x) : null` nullable handling.

`fromX`/`toX` ID bridge (from request analog lines 11-14):
```typescript
export const toApprovalChainId = (raw: Id<"approvalChains">): ApprovalChainId => buildApprovalChainId(raw);
export const fromApprovalChainId = (b: ApprovalChainId): Id<"approvalChains"> => b as string as Id<"approvalChains">;
```
Entity mapper casts string columns to branded unions exactly like request mapper line 25 (`doc.status as ChainStatus`, `doc.state as TaskState`). `approverId`/`approverRoleId` are stored as plain strings → rebrand with `buildUserId(doc.approverId)` / `buildRoleId(doc.approverRoleId)` (pattern: `policyVersions.createdBy` stored as `v.string()` in schema line 65).

---

### `src/modules/approval/application/approval-routing-service.ts` (service — event-driven + CRUD) — THE CORE

**Composite analog:** `policy-runtime-service.ts` (constructor + dispatcher shape) + `user-service.ts` `setManager` (the manager-walk loop) + RESEARCH Patterns 3-5.

**Constructor pattern** (from `policy-runtime-service.ts` lines 11-17) — constructor-injected ports only (D-18), never `new`s an adapter:
```typescript
export class ApprovalRoutingService {
  constructor(
    private readonly chainRepo: ApprovalChainRepositoryPort,
    private readonly taskRepo: ApprovalTaskRepositoryPort,
    private readonly userRepo: UserRepositoryPort,   // from directory barrel
    private readonly roleRepo: RoleRepositoryPort,   // from directory barrel
    private readonly evalRepo: RequestEvaluationRepositoryPort, // from request barrel
    private readonly dispatcher: EventDispatcher<ApprovalEventMap>,
  ) {}
}
```

**Manager-walk** — copy the bounded-loop shape from `user-service.ts` lines 88-107 (`MAX_MANAGER_CHAIN_DEPTH = 50` at line 8; cursor starts at `newManager.managerId`; `findById` each cursor; `break` on missing; increment `depth`; throw on cap). Adapt per D-49/D-50:
```typescript
const MAX_HIERARCHY_DEPTH = 50; // mirrors user-service.ts line 8
let cursorId: UserId | null = requester.managerId;   // self excluded (D-49)
let depth = 0;
while (cursorId) {
  if (depth >= MAX_HIERARCHY_DEPTH) throw new HierarchyTraversalError(/* ... */); // D-50
  const cursor = await this.userRepo.findById(ctx, cursorId);
  if (!cursor) break;                                  // broken link → RoutingError
  if (cursor.roleId === targetRoleId) return cursor;   // first holder = approver (D-43)
  cursorId = cursor.managerId;
  depth++;
}
throw new RoutingError(/* ... */);                     // strict, no fallback (D-43)
```

**`onRequestEvaluated(event)`** flow (reads decision via repo, never from event payload — D-47):
1. `chainRepo.findByRequestEvaluationId(ctx, event.evaluationRecordId)` — if non-null, no-op (idempotency, Pitfall 5).
2. `evalRepo.findById(ctx, event.evaluationRecordId)` → read `decision` + `requesterId`.
3. If `decision?.kind !== "request-approval"` → ignore (the `Decision` union is from `runtime/index.js` barrel, line 6-9 of `decision.ts`, read-only — SC#1).
4. `roleRepo.findById(ctx, decision.targetRoleId)` → null → `RoleNotFoundError` (directory barrel) — SC#3.
5. Resolve requester (`userRepo.findById`) → manager-walk → approver.
6. Materialize `chainRepo.create({ requestEvaluationId, status: "IN_PROGRESS" })` then `taskRepo.create({ chainId, stageNumber: 1, approverId, approverRoleId, state: "PENDING" })` (D-44 immutable snapshot).
7. Wrap the routing body in try/catch: on `RoutingError`/`RoleNotFoundError`/`HierarchyTraversalError` emit `"ApprovalRoutingFailed"` and **do not rethrow** (RESEARCH A3/Open-Q2 — keeps the submit mutation committed; the `RequestEvaluation` stays persisted per D-54).

**`act(ctx, taskId, action)`** guards (D-52) — apply BEFORE the pure transition:
```typescript
const task = await this.taskRepo.findById(ctx, taskId);
if (task.state !== "PENDING") throw new TaskAlreadyResolvedError(taskId);     // idempotency/terminal
if (ctx.actorId !== task.approverId) throw new UnauthorizedApproverError(...);// auth (D-48 actorId)
const nextState = transitionTask(task.state, action);     // pure (state-machine.ts)
await this.taskRepo.updateState(ctx, taskId, nextState);
const chainStatus = deriveChainStatus([nextState]);       // one task in Phase 5
await this.chainRepo.updateStatus(ctx, task.chainId, chainStatus);
await this.dispatcher.emit(action === "APPROVE" ? "ApprovalTaskApproved" : "ApprovalTaskRejected", {
  tenantId: ctx.tenantId, taskId, chainId: task.chainId, actorId: ctx.actorId!, timestamp: Date.now(),
});
```
`act()` reads the stored `approverId` — never re-walks the hierarchy (D-44, RESEARCH anti-pattern).

**Emit pattern** copied from `policy-runtime-service.ts` lines 62-66 / 83-88 (`await this.dispatcher.emit("...", { tenantId: ctx.tenantId, ..., timestamp: Date.now() })`).

---

### `src/modules/approval/index.ts` (barrel)

**Analog:** `src/modules/request/index.ts` (lines 1-29). Mirror the grouped-comment structure: Domain entities → Domain events → Application services → Application errors → Repository ports → Memory adapters → Convex adapters → re-export `EventDispatcher` from `@/shared/event-dispatcher.js` (line 28). Export the branded-ID factories (`approvalChainId`, `approvalTaskId`) for convex/ DI (line 4 of analog).

---

### `convex/approval.ts` or extend `convex/request.ts` (thin DI — event-driven)

**Analog:** `convex/request.ts` (whole file, lines 1-69). Reproduce the HARD-RULE header comment (lines 1-5). The composition root constructs repos from `ctx.db`, builds the dispatcher, instantiates the service, and subscribes — NO branching/walk in convex/ (Pitfall 6).

Subscription seam (RESEARCH Pattern 5), wired the same way `RequestAuditSubscriber` is at line 29:
```typescript
const routingService = new ApprovalRoutingService(chainRepo, taskRepo, userRepo, roleRepo, evalRepo, approvalDispatcher);
requestDispatcher.on("RequestEvaluated", (e) => routingService.onRequestEvaluated(e));
```
Per Open-Q1/Q2: subscribe inside the **same `submitRequest` mutation** so routing shares `ctx.db` (the transaction); the service swallows its own routing errors so the mutation still commits. `request/` keeps NO import of `approval/` (SC#1 holds structurally).

---

### Test files (`tests/modules/approval/*.test.ts`)

**Analog:** `tests/modules/request/request-audit-subscriber.test.ts` (lines 1-40). Copy: `import { describe, it, expect } from "vitest"`; setup via `tests/_helpers/in-memory-fakes.ts` helper; tenant fixtures from `tests/_helpers/tenant-context-fixture.ts` (`TENANT_A`); branded IDs via barrel factories (`userId("user_actor")`, line 5/7). `state-machine.test.ts` is pure-function table tests (no fakes). Coverage target 100% on domain + application + memory (excludes `index.ts` + `adapters/convex/**` per `vitest.config.ts`).

## Modified-File Patterns

### `src/shared/event-dispatcher.ts` — D-54 (run `gitnexus_impact({target: "EventDispatcher", direction: "upstream"})` first — 3 callers: setupPolicy, setupRequest, convex/request.ts)

Current loop (lines 27-29) aborts on the first throw:
```typescript
for (const h of this.handlers.get(type) ?? []) {
  await h(event);
}
```
**Keep the sequential `for...await` shape** (Pitfall 4 — do NOT switch to `Promise.all`), wrap each handler:
```typescript
for (const h of this.handlers.get(type) ?? []) {
  try {
    await h(event);
  } catch (err) {
    this.onError?.(type, err); // record, don't swallow silently (Pitfall 3 / D-54)
  }
}
```
Add an optional `onError?(type, err)` hook (or a recorded-failures array) so failures are observable. Signature of `emit`/`on` unchanged → additive. Existing 6 dispatcher tests stay green; add 2 isolation cases.

### `src/modules/directory/application/tenant-context.ts` — D-48 (make `actorId` OPTIONAL, Pitfall 1)

Current (lines 8-12):
```typescript
export interface TenantContext { readonly tenantId: TenantId; }
export const tenantContext = (tenantId: TenantId): TenantContext => ({ tenantId });
```
Extend additively (optional field + optional factory arg) so all ~30 existing `tenantContext(tid)` / `{ tenantId }` sites stay valid:
```typescript
import type { TenantId, UserId } from "../domain/ids.js";
export interface TenantContext {
  readonly tenantId: TenantId;
  readonly actorId?: UserId;
}
export const tenantContext = (tenantId: TenantId, actorId?: UserId): TenantContext => ({ tenantId, actorId });
```
`directory/index.ts` already re-exports `TenantContext`/`tenantContext` (lines 9-10) — no barrel change needed beyond ensuring `UserId` stays exported (it is, line 6).

### `src/modules/request/domain/request-evaluation.ts` + port + fakes + convex — D-47/D-48 (`requesterId: UserId | null`)

- Entity (line 1 import `UserId` already present): add `readonly requesterId: UserId | null;`.
- `CreateRequestEvaluationInput` (port lines 8-17): add `readonly requesterId: UserId | null;`.
- In-memory fake `create` (lines 13-25): add `requesterId: input.requesterId`.
- Convex repo `create` (lines 15-26): add `requesterId: input.requesterId` (store as plain string or null — `policyVersions.createdBy` is the `v.string()` precedent).
- Convex mapper (line 17-29): add `requesterId: doc.requesterId ? buildUserId(doc.requesterId) : null` (nullable pattern from `directory mappers.ts` line 37).
- `policy-runtime-service.ts` `submit` (both `create` calls, lines 51-60 + 72-81): add `requesterId: ctx.actorId ?? null`.

### `convex/schema.ts` — D-09 tenant-prefixed + reverse-lookup indexes

Extend `requestEvaluations` (lines 80-93) with `requesterId: v.union(v.string(), v.null())` (nullable for pre-existing rows — Runtime State Inventory A1). Add two tables after it, mirroring the existing `defineTable(...).index(...)` style (every index `tenantId`-prefixed per the file's D-09 header comment lines 6-7):
```typescript
approvalChains: defineTable({
  tenantId: v.id("tenants"),
  requestEvaluationId: v.id("requestEvaluations"),
  status: v.string(),
  createdAt: v.number(),
})
  .index("by_tenant_created", ["tenantId", "createdAt"])
  .index("by_tenant_request_evaluation", ["tenantId", "requestEvaluationId"]),

approvalTasks: defineTable({
  tenantId: v.id("tenants"),
  chainId: v.id("approvalChains"),
  stageNumber: v.number(),
  approverId: v.string(),
  approverRoleId: v.string(),
  state: v.string(),
  createdAt: v.number(),
})
  .index("by_tenant_chain", ["tenantId", "chainId"])
  .index("by_tenant_approver", ["tenantId", "approverId"]),
```
`requestEvaluationId`/`chainId` are `v.id(...)` (cross-table refs); `approverId`/`approverRoleId` are `v.string()` (branded strings, like `policyVersions.createdBy` line 65).

### `eslint.config.js` — D-08 add approval zone (mirror request zone lines 51-55)

Add to the `zones` array:
```javascript
{
  target: "./src/modules/!(approval)/**/*",
  from: "./src/modules/approval/{domain,application,adapters}/**/*",
  message: "Cross-module deep imports forbidden. Import from '@/modules/approval' (barrel) instead — Module Boundary Rule (D-08).",
},
```
The generic domain-purity (lines 56-59), application-no-adapter (lines 62-64), and convex/ zones (lines 67-75) already cover the new module via the `*` wildcards — no per-module duplication needed for those.

### `tests/_helpers/in-memory-fakes.ts` — add `setupApproval` (mirror `setupRequest` lines 42-65)

Compose on top of `setupRequest` (it returns `evalRepo`, `requestDispatcher`, `auditRepo`), add chain/task fakes + `directory` `userRepo`/`roleRepo` (from `setupDirectory`), build an `ApprovalEventMap` dispatcher, wire the approval audit subscriber and `requestDispatcher.on("RequestEvaluated", e => routingService.onRequestEvaluated(e))`. `void new`-style subscriber wiring per lines 31/47.

## Shared Patterns

### Authentication / Authorization
No middleware/guard layer exists — authorization is **in-service** via `ctx.actorId` comparison (D-52). Source pattern: this phase introduces it (`act()` guard). `TenantContext` is the only ambient envelope; D-19 (ctx-first parameter) is the project-wide invariant — see `user-service.ts`, `policy-runtime-service.ts`, every port. **Apply to:** every `ApprovalRoutingService` method.

### Tenant scoping (CON-01)
**Source:** `in-memory-request-evaluation-repository.ts` lines 32-34 and `convex-request-evaluation-repository.ts` line 35 — every read checks `record.tenantId !== ctx.tenantId → return null`; every Convex list uses `.withIndex("by_tenant_*", q => q.eq("tenantId", fromTenantId(ctx.tenantId)))`. **Apply to:** all approval repository adapters (memory + convex).

### Error handling
**Source:** `src/modules/directory/application/errors.ts` lines 1-43 — `class X extends Error { constructor(public readonly field) { super(msg); this.name = "X"; } }`. No central error wrapper; services throw typed errors and convex/ maps them. **Apply to:** `approval/application/errors.ts` + the routing-failure swallow path.

### Event dispatch + by-reference audit (D-37/D-53)
**Source (emit):** `policy-runtime-service.ts` lines 62-66 — `await this.dispatcher.emit("Type", { tenantId: ctx.tenantId, ...ids, timestamp: Date.now() })`.
**Source (subscribe + audit):** `request-audit-subscriber.ts` lines 13-53 — constructor takes `(auditRepo, dispatcher)`, calls `dispatcher.on("Event", async (event) => { const ctx = { tenantId: event.tenantId }; await this.auditRepo.create(ctx, { eventType: "<aggregate>.<action>", payload: { ...IDs only } }); })`. Payload carries IDs/metadata only — never content. `AuditLogRepositoryPort.create(ctx, { eventType, payload })` already exists (`audit-log-repository.port.ts` lines 9-12). **Apply to:** new approval audit handlers — `approval.task_approved`, `approval.task_rejected`, `approval.routing_failed`.

### Branded-ID ↔ Convex Id bridge
**Source:** `request/adapters/convex/mappers.ts` lines 11-14 (`toX`/`fromX` cast bridge) + `convex/_branded.ts` lines 1-11 (`brandedString` validators — only `TenantId`/`UserId`/`RoleId` exist; new IDs are stored via `v.id(...)` or `v.string()`, so `_branded.ts` likely needs NO change). Casts live ONLY at the adapter boundary (`directory/domain/ids.ts` doc comment lines 1-5). **Apply to:** `approval/adapters/convex/mappers.ts`.

### Composition-root DI (convex/ HARD RULE)
**Source:** `convex/request.ts` lines 19-57 + header comment lines 1-5 — handler builds repos from `ctx.db`, constructs dispatcher + subscribers (`void new ...`), instantiates the service, calls it. No domain logic in convex/. **Apply to:** approval wiring + the routing subscription seam.

## No Analog Found

| File | Role | Data Flow | Reason / Mitigation |
|------|------|-----------|---------------------|
| `src/modules/approval/domain/state-machine.ts` | domain (pure fns) | transform | No existing module has standalone transition functions. Pure/trivial (D-51, 2 transitions). Follow RESEARCH Pattern 4. Resolve the domain-purity-zone constraint: throw a domain-local error or move the terminal guard into the service `act()`. |

All other files have an exact or role-exact in-repo template.

## Metadata

**Analog search scope:** `src/modules/{request,directory,audit,policy,runtime}/`, `src/shared/`, `convex/`, `tests/`, `eslint.config.js`
**Files scanned:** 35 (read in full or targeted)
**Primary whole-module analog:** `src/modules/request/` (most recent, closest structurally)
**Manager-walk template:** `src/modules/directory/application/user-service.ts` `setManager` lines 69-110 (`MAX_MANAGER_CHAIN_DEPTH = 50`)
**Pattern extraction date:** 2026-06-03

> GitNexus mandate (CLAUDE.md): the planner MUST run `gitnexus_impact` before editing `EventDispatcher`, `policy-runtime-service.ts submit`, and any other concrete symbol touched, and `gitnexus_detect_changes()` pre-commit. `EventDispatcher` impact pre-verified LOW (3 callers) in RESEARCH.
