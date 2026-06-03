# Phase 5: Approval Routing (Reference Decision Consumer) - Research

**Researched:** 2026-06-03
**Domain:** Decision-consumer service layer (manager-chain resolution + approval state machine) on Hexagonal/Modular-Monolith TypeScript + Convex
**Confidence:** HIGH (all findings verified against in-repo source; no external library research needed)

## Summary

Phase 5 adds a **new module** (recommend `approval/`) that mirrors the existing five-module Hexagonal skeleton exactly. It is a *Decision Consumer*: it subscribes to the existing `"RequestEvaluated"` event on a shared `EventDispatcher`, fetches the persisted `RequestEvaluation`, and — for `request-approval` decisions — walks the requester's `managerId` chain to the first ancestor holding `targetRoleId`, then materializes an immutable `ApprovalChain` + single `ApprovalTask` and runs a deterministic Approve/Reject state machine. Everything the consumer needs to read already exists in the codebase; **no new external libraries are required** and there are no package-legitimacy concerns this phase.

The work is overwhelmingly **pattern replication**, not novel design. Every artifact the plan produces has an exact in-repo template: branded IDs (`directory/domain/ids.ts`), custom errors (`request/application/errors.ts`), constructor-injected repository ports (`request/ports/*.port.ts`), in-memory fakes (`request/adapters/memory/*`), Convex adapters + `_branded.ts` bridge + mappers (`request/adapters/convex/*`), tenant-prefixed indexes (`convex/schema.ts`), the by-reference audit subscriber (`audit/application/request-audit-subscriber.ts`), the bounded manager-walk loop (`directory/application/user-service.ts` `setManager`, lines 88-107), and the thin-DI Convex handler (`convex/request.ts`). The three cross-cutting ripples — `TenantContext.actorId` (D-48), `RequestEvaluation.requesterId` (D-47/D-48), and `EventDispatcher` hardening (D-54) — are all **additive** and verified LOW-risk by GitNexus impact analysis.

**Primary recommendation:** Create module `src/modules/approval/` with the standard `{domain, application, ports, adapters/{memory,convex}, index.ts, README.md}` layout. Make `actorId` **optional** on `TenantContext` so existing call sites and `tenantContext(tid)` do not break; thread `ctx.actorId → RequestEvaluation.requesterId` in `submit()`. Harden `EventDispatcher.emit` with a per-handler `try/catch` that records and continues. Subscribe `ApprovalRoutingService` to `"RequestEvaluated"` at the composition root (`convex/request.ts` + the test `setupRequest` helper). Target **100% coverage** on routing + state-machine logic (`docs/engineering.md` line 42 names "Approval Workflow Generation" at 100%, stricter than the 90% in the context).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Subscribe to `"RequestEvaluated"` | Composition root (`convex/` + test helper) | — | Wiring only; Convex HARD RULE permits DI assembly here. Runtime keeps no compile-time dep (SC#1). |
| Manager-chain resolution (walk to role-holder) | Application (`ApprovalRoutingService` / resolver) | Port → adapter (Convex/memory) | Pure business logic; reads `User`/`Role` via directory **barrel** only (D-08). |
| `targetRoleId` registry validation | Application | `RoleRepositoryPort.findById` | SC#3 — authoritative role check before routing. |
| Chain/task materialization + persistence | Application orchestrates → Port → adapter | — | Entities are plain TS (D-13); persistence behind ports (D-18). |
| Approve/Reject state machine | Domain (pure transition fns) + Application (guards) | — | Deterministic; guards (auth + idempotency) in service layer (D-52), transitions pure. |
| Tenant-prefixed persistence + reverse-lookup indexes | Adapter (Convex) | `convex/schema.ts` | D-09; no domain logic in convex/. |
| Audit by-reference on `approval.*` | Application (`AuditEventSubscriber`/new subscriber) | Port → audit adapter | Governance ledger only; ops source of truth is the chain/task tables (D-37/D-53). |
| Subscriber failure isolation | Shared (`EventDispatcher`) | — | Cross-cutting; D-54 wraps each handler so failures never bubble into `submit()`. |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Chain Construction (Area 1)**
- **D-43 — Strict manager-chain resolution.** Walk `managerId` upward; resolve to the **first ancestor holding `targetRoleId`**. Found → create the approval stage. Chain terminates without a match → throw `RoutingError`: no `ApprovalTask` created, no fallback approver, no implicit CEO escalation. Emit a lightweight audit event for observability and surface the error. Role requirements are authoritative — never silently substituted.
- **D-44 — Resolve once at creation, immutable snapshot.** Chain resolved once when the Request-Approval Decision is consumed, then materialized + persisted. Stored stage data: `stageNumber`, `approverId`, `approverRoleId`. Chains are immutable after creation — later changes to `managerId`, role assignments, or org hierarchy do NOT affect already-created flows.
- **D-45 — Only the resolved role-holder is a stage.** Intermediate managers do NOT automatically become approvers. Org hierarchy determines WHO holds a role; policy determines WHICH role is required. Multi-role multi-stage workflows are deferred and must be explicitly declared by policy, never inferred from hierarchy depth.
- **D-46 — `ApprovalChain` + `ApprovalTask` are separate entities.** `ApprovalChain` owns `id`, `requestEvaluationId`, `status`. `ApprovalTask` owns `chainId`, `stageNumber`, `approverId`, `approverRoleId`, `state`. Phase 5 chains contain exactly **one** task, `stageNumber = 1`. No parallel stages, branching, escalation, retries, deadlines. Future phases extend `ApprovalChain` **without schema replacement**.

**Decision Hand-off (Area 2)**
- **D-47 — `RequestEvaluatedEvent` stays minimal.** Payload remains `{ tenantId, evaluationRecordId, timestamp }`. Consumers fetch the `RequestEvaluation` through repositories; Decision/Trace data is never duplicated into events. `RequestEvaluation` gains a `requesterId` field. Routing resolves: `evaluationRecordId → RequestEvaluation → requesterId + decision → routing`.
- **D-48 — Requester identity from `TenantContext.actorId`.** During submission, `ctx.actorId → RequestEvaluation.requesterId`. `EvaluationContext` remains domain-neutral and does NOT contain `requesterId`. Routing walks manager chains using the snapshotted `RequestEvaluation.requesterId`, not the current execution context.

**Approver Resolution (Area 3)**
- **D-49 — Walk starts at `requester.managerId` (self excluded).** `cursor = requester.managerId; while (cursor != null) { if (cursor.roleId === targetRoleId) return cursor; cursor = cursor.managerId; } throw RoutingError;`. Requester never self-approves even if they hold `targetRoleId`. Approver is a specific resolved user (`approverId`), not a role-bucket.
- **D-50 — Pre-routing validation + defensive depth cap.** (1) Validate `targetRoleId` exists in the tenant Role registry (`roleRepo.findById`); missing → `RoleNotFoundError` (SC#3). (2) Walk with a defensive depth limit `MAX_HIERARCHY_DEPTH = 50`; exceeded → `HierarchyTraversalError`. The cap is a safety guard, not a business rule — D-11 (cycle prevention in `setManager`) is the primary protection.

**Reject & State Machine (Area 4)**
- **D-51 — Deterministic state machines.** `ApprovalTask`: `PENDING → APPROVED` | `PENDING → REJECTED` (both terminal). `ApprovalChain`: `IN_PROGRESS → APPROVED` (all tasks APPROVED) | `IN_PROGRESS → REJECTED` (any task REJECTED, immediately terminates). Phase 5: one task ⇒ task outcome directly determines chain outcome. Same machine valid for future multi-stage, no schema changes.
- **D-52 — Authorization + idempotency on actions.** Only `ctx.actorId === task.approverId` may act. Guards: `if (task.state !== PENDING) throw TaskAlreadyResolvedError; if (ctx.actorId !== task.approverId) throw UnauthorizedApproverError;`.
- **D-53 — Approval actions are auditable.** On `PENDING → APPROVED`/`REJECTED`, emit `ApprovalTaskApproved`/`ApprovalTaskRejected` with `{ tenantId, taskId, chainId, actorId, timestamp }`. `AuditEventSubscriber` consumes these and writes `AuditLog` by-reference (`eventType`, `taskId`, `actorId`, `timestamp` — never content). Chain/task are operational source of truth; `AuditLog` is governance ledger only (D-37).

**Consumer ↔ Runtime Error Isolation**
- **D-54 — Subscriber failures isolated by `EventDispatcher`.** Wrap each subscriber: a failing subscriber must NOT prevent others executing and must NOT bubble back into request submission. `for each subscriber: try execute; catch error: record failure; continue`. Routing failures (`RoutingError`, `RoleNotFoundError`, `HierarchyTraversalError`) produce an `ApprovalRoutingFailed` event / observability+audit record. `RequestEvaluation` remains persisted and valid even if routing later fails.

### Claude's Discretion
- **Module naming/placement** — `approval/` vs `routing/`; standard `{domain, application, ports, adapters, index.ts, README.md}` skeleton; barrel-only imports (D-08) + a new ESLint `no-restricted-paths` zone. `Decision`/`RequestEvaluation`/`User`/`Role` come from other modules' barrels — no deep imports.
- **Branded IDs** — `ApprovalChainId`, `ApprovalTaskId` owned by the new module; `status`/`state` as small string unions.
- **Convex tables + indexes** — `approvalChains`, `approvalTasks` with tenant-prefixed composite indexes (D-09); reverse-lookup index on `requestEvaluationId` (chain → request) and `chainId` (tasks → chain). Thin DI handlers only.
- **Where routing subscribes** — wiring `ApprovalRoutingService` onto `EventDispatcher.on("RequestEvaluated", ...)` at the composition root.
- **Event/error constant names** — exact strings for `ApprovalTaskApproved`/`ApprovalTaskRejected`/`ApprovalRoutingFailed` and the `approval.*` audit `eventType` convention (`<aggregate>.<action>`, e.g. `approval.task_approved`, `approval.routing_failed`).
- **`TenantContext.actorId` typing** — optional vs required; how submit threads it into `RequestEvaluation.requesterId`.
- **Test fixtures** — manager-hierarchy graphs → expected chain/approver tuples; state-machine transition tables; in-memory repositories per D-20.

### Deferred Ideas (OUT OF SCOPE)
- **Multi-stage / multi-role approval chains** — deferred to a future policy-declared model (D-45/D-46). Entities/state machine already support it without schema replacement.
- **Parallel stages, branching, escalation, retries, deadlines** — out of scope (D-46).
- **Fallback approvers / implicit CEO escalation** — explicitly rejected (D-43). Unresolvable chains fail with `RoutingError`.
- **Notifications / webhooks on chain completion** — future Decision Consumers (v2).
- **Approver inbox UI + Approve/Reject actions UI** — Phase 6 (UI-03). Phase 5 exposes services + thin Convex handlers only.
- **Role-bucket claims** (any holder of `approverRoleId` can act) — rejected for Phase 5 (D-49/D-52 resolve a specific `approverId`).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEC-03 | Ship a reference Decision Consumer (Approval Routing) that converts Request-Approval Decisions into sequential approval chains; runtime has no compile-time dependency on it. | Architecture Patterns §Decision-Consumer subscription seam (`EventDispatcher.on("RequestEvaluated")`); §Manager-walk resolver (mirrors `setManager` loop); §State machine (D-51); §Convex tables/indexes. SC#1 proof: runtime/`Decision`/`RequestEvaluatedEvent` are read-only and unchanged. |
| CON-04 (consumed) | Supervisor reporting lines (`managerId`) resolve hierarchy paths. Validated Phase 1; consumed here. | `User.managerId: UserId \| null` + `setManager` bounded-walk template are the resolution inputs (D-49/D-50). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x (strict) | Domain/application/adapter code | Project baseline since Phase 1; `no-explicit-any` enforced. [VERIFIED: in-repo eslint.config.js line 80] |
| Vitest | 4.1.7 | Test runner + v8 coverage | Established since Phase 1; coverage thresholds in `vitest.config.ts`. [VERIFIED: package.json devDeps] |
| Convex | (installed) | Persistence adapter + thin DI handlers | Sole persistence layer; `convex/` HARD RULE limits it to DI assembly. [VERIFIED: convex/ present, schema.ts] |
| convex-helpers | (installed) | `brandedString` validators in `convex/_branded.ts` | Bridges branded domain IDs ↔ Convex `Id<>`. [VERIFIED: convex/_branded.ts imports `convex-helpers/validators`] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| eslint-plugin-import | (installed) | `import/no-restricted-paths` module-boundary zones | Add one new zone for the `approval/` module (D-08). [VERIFIED: eslint.config.js] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled state-machine guards | XState / a state-machine lib | Rejected — D-51 machines are trivial (2 transitions, all terminal); a library adds a dependency and indirection for zero benefit. Pure functions + service guards match the existing app-layer-invariants pattern. |
| New `routing/` module name | `approval/` module name | Both valid (Claude discretion). **Recommend `approval/`** — entities are `ApprovalChain`/`ApprovalTask`, errors are approval-domain, and `approval.*` is the audit eventType prefix; the module name should match its aggregate root. |

**Installation:** None. No new packages. This phase installs zero external dependencies.

## Package Legitimacy Audit

**Not applicable — Phase 5 installs no external packages.** All required libraries (TypeScript, Vitest, Convex, convex-helpers, eslint-plugin-import) are already present and verified in the repo from prior phases. No npm/PyPI/crates install step exists in this phase, so there is no slopsquatting surface. The planner does not need any `checkpoint:human-verify` install gates for Phase 5.

## Architecture Patterns

### System Architecture Diagram

```
                          PolicyRuntimeService.submit(ctx, input)   [request module — UNCHANGED API]
                                        │
              (D-48) ctx.actorId ───────┤ thread into create()
                                        ▼
                          evalRepo.create({ ..., requesterId })   ──►  requestEvaluations table (+requesterId col)
                                        │
                                        ▼
                    dispatcher.emit("RequestEvaluated", {tenantId, evaluationRecordId, timestamp})
                                        │
            ┌───────────────────────────┼───────────────────────────────┐
            ▼ (existing subscriber)      ▼ (NEW subscriber)               │  D-54: EventDispatcher.emit
   RequestAuditSubscriber        ApprovalRoutingService.onRequestEvaluated │  wraps EACH handler in
   (audit by-reference)                 │                                  │  try/catch → record + continue.
            │                            ▼                                 │  One subscriber's failure never
            ▼                  evalRepo.findById(evaluationRecordId)        │  blocks the other or bubbles
      auditLogs table                   │                                  │  into submit().
                                        ▼ read decision + requesterId      └──────────────────────────────
                          decision.kind === "request-approval" ?
                                   │ no                    │ yes
                                   ▼                       ▼
                                 (ignore)        ┌─ validate targetRoleId in Role registry  [SC#3]
                                                 │     missing → RoleNotFoundError
                                                 ├─ walk requester.managerId chain (self excluded, D-49)
                                                 │     cap MAX_HIERARCHY_DEPTH=50 → HierarchyTraversalError
                                                 │     no role-holder found → RoutingError
                                                 ▼
                                       materialize (immutable snapshot, D-44):
                                         ApprovalChain { requestEvaluationId, status: IN_PROGRESS }
                                         ApprovalTask  { chainId, stageNumber:1, approverId, approverRoleId, state: PENDING }
                                         ──► approvalChains / approvalTasks tables
                                                 │
                  (failure path) ────────────────┘
                  emit "ApprovalRoutingFailed" {tenantId, evaluationRecordId, reason}  →  audit by-reference

                          ── later, approver acts ──
              ApprovalRoutingService.act(ctx, taskId, "APPROVE"|"REJECT")
                  guard: task.state===PENDING else TaskAlreadyResolvedError   (D-52)
                  guard: ctx.actorId===task.approverId else UnauthorizedApproverError
                       │
                       ▼ pure transition (D-51)
                  task → APPROVED|REJECTED ; chain → APPROVED|REJECTED
                       │
                       ▼
                  emit "ApprovalTaskApproved"|"ApprovalTaskRejected" {tenantId, taskId, chainId, actorId, timestamp}
                       │
                       ▼  (new approval audit subscriber)
                  auditLogs table  (eventType: approval.task_approved / approval.task_rejected, by-reference)
```

### Recommended Project Structure

Mirror the `request/` module exactly (most recent and closest analog):

```
src/modules/approval/
├── domain/
│   ├── ids.ts                     # ApprovalChainId, ApprovalTaskId (branded) — template: directory/domain/ids.ts
│   ├── approval-chain.ts          # plain TS interface (D-13)
│   ├── approval-task.ts           # plain TS interface (D-13)
│   ├── approval-status.ts         # ChainStatus = "IN_PROGRESS"|"APPROVED"|"REJECTED" (string union)
│   ├── approval-task-state.ts     # TaskState = "PENDING"|"APPROVED"|"REJECTED" (string union)
│   ├── state-machine.ts           # PURE transition fns (approveTask/rejectTask/deriveChainStatus) — 100% coverage target
│   └── approval-events.ts         # ApprovalEventMap: ApprovalTaskApproved/Rejected/ApprovalRoutingFailed
├── application/
│   ├── approval-routing-service.ts # onRequestEvaluated + act(); constructor-injected ports (D-18)
│   └── errors.ts                  # RoutingError, RoleNotFoundError*, HierarchyTraversalError, TaskAlreadyResolvedError, UnauthorizedApproverError
├── ports/
│   ├── approval-chain-repository.port.ts
│   └── approval-task-repository.port.ts
├── adapters/
│   ├── memory/                    # in-memory fakes (D-20) — templates: request/adapters/memory/*
│   │   ├── in-memory-approval-chain-repository.ts
│   │   └── in-memory-approval-task-repository.ts
│   └── convex/
│       ├── convex-approval-chain-repository.ts
│       ├── convex-approval-task-repository.ts
│       └── mappers.ts             # toX/fromX ID mappers + entity mappers — template: request/adapters/convex/mappers.ts
├── index.ts                       # public barrel
└── README.md
```

\* `RoleNotFoundError` already exists in `directory/application/errors.ts` and is exported from the directory barrel. Decide: **reuse** the directory one (it takes a `RoleId`) or define an approval-local one. Recommend **reusing the directory barrel export** for consistency — it already exists and is semantically identical (SC#3 "role does not exist").

### Pattern 1: Branded IDs owned by the defining module (D-14/D-15)
**What:** Zero-runtime-cost branded strings + factory.
**Example:**
```typescript
// Source: src/modules/directory/domain/ids.ts (in-repo template)
export type ApprovalChainId = string & { readonly __brand: "ApprovalChainId" };
export type ApprovalTaskId  = string & { readonly __brand: "ApprovalTaskId" };
export const approvalChainId = (raw: string): ApprovalChainId => raw as ApprovalChainId;
export const approvalTaskId  = (raw: string): ApprovalTaskId  => raw as ApprovalTaskId;
```

### Pattern 2: Constructor-injected repository ports (D-18), TenantContext-first (D-19)
**Example:**
```typescript
// Source: src/modules/request/ports/request-evaluation-repository.port.ts + directory ports
export interface ApprovalChainRepositoryPort {
  create(ctx: TenantContext, input: { requestEvaluationId: RequestEvaluationId; status: ChainStatus }): Promise<ApprovalChain>;
  findById(ctx: TenantContext, id: ApprovalChainId): Promise<ApprovalChain | null>;
  findByRequestEvaluationId(ctx: TenantContext, id: RequestEvaluationId): Promise<ApprovalChain | null>; // reverse lookup + idempotency
  updateStatus(ctx: TenantContext, id: ApprovalChainId, status: ChainStatus): Promise<ApprovalChain>;
}
```
Every method takes `ctx: TenantContext` first; every read filters by `ctx.tenantId` (CON-01). The service receives ports via constructor — never `new`s an adapter.

### Pattern 3: Bounded manager-chain walk (D-49/D-50)
**What:** Reuse the exact loop shape from `setManager`.
**Example:**
```typescript
// Source: src/modules/directory/application/user-service.ts lines 88-107 (the traversal template)
const MAX_HIERARCHY_DEPTH = 50;
async function resolveApprover(ctx, requester: User, targetRoleId: RoleId, userRepo): Promise<User> {
  let cursorId: UserId | null = requester.managerId;   // self excluded (D-49)
  let depth = 0;
  while (cursorId) {
    if (depth >= MAX_HIERARCHY_DEPTH) throw new HierarchyTraversalError(...);  // defensive cap (D-50)
    const cursor = await userRepo.findById(ctx, cursorId);
    if (!cursor) break;                                  // broken link → falls through to RoutingError
    if (cursor.roleId === targetRoleId) return cursor;   // first ancestor holding role = approver
    cursorId = cursor.managerId;
    depth++;
  }
  throw new RoutingError(...);                            // no match — strict, no fallback (D-43)
}
```
Note: `userRepo.findById` / `roleRepo.findById` come from the **directory barrel** (`@/modules/directory/index.js`), which already exports `UserRepositoryPort` + `RoleRepositoryPort` + `User`/`Role`/`UserId`/`RoleId`. No deep import.

### Pattern 4: Pure state-machine + service guards (D-51/D-52)
**Example:**
```typescript
// domain/state-machine.ts — pure, deterministic, 100% coverage target
export function transitionTask(state: TaskState, action: "APPROVE"|"REJECT"): TaskState {
  if (state !== "PENDING") throw new TaskAlreadyResolvedError();   // terminal guard
  return action === "APPROVE" ? "APPROVED" : "REJECTED";
}
export function deriveChainStatus(taskStates: readonly TaskState[]): ChainStatus {
  if (taskStates.some(s => s === "REJECTED")) return "REJECTED";   // any reject → terminate (D-51)
  if (taskStates.every(s => s === "APPROVED")) return "APPROVED";
  return "IN_PROGRESS";
}
// application: act() applies auth guard (ctx.actorId === task.approverId) BEFORE calling transitionTask
```

### Pattern 5: Decision-Consumer subscription (the SC#1 proof)
**What:** Wire the service to `"RequestEvaluated"` at the composition root — the same shape audit subscribers already use.
**Example:**
```typescript
// Source: convex/request.ts (composition root) + tests/_helpers/in-memory-fakes.ts setupRequest
const requestDispatcher = new EventDispatcher<RequestEventMap>();
void new RequestAuditSubscriber(auditRepo, requestDispatcher);          // existing
const routingService = new ApprovalRoutingService(chainRepo, taskRepo, userRepo, roleRepo, approvalDispatcher);
requestDispatcher.on("RequestEvaluated", (e) => routingService.onRequestEvaluated(e));  // NEW seam
```
The runtime emits a string event; the consumer subscribes. `request/` has **no import of `approval/`** — SC#1 holds structurally.

### Anti-Patterns to Avoid
- **Putting routing logic in `convex/`** — violates the HARD RULE. `convex/approval.ts` (or extending `convex/request.ts`) only wires DI and maps responses.
- **Deep-importing `User`/`Role`/`Decision`/`RequestEvaluation`** — must go through each module's barrel (D-08). The new ESLint zone enforces this for the approval module.
- **Re-resolving the chain at action time** — chains are immutable snapshots (D-44). `act()` reads the stored `approverId`, never re-walks the hierarchy.
- **Duplicating Decision/Trace into events** — D-47. The consumer fetches `RequestEvaluation` by ID.
- **Making `TenantContext.actorId` required** — would break every existing `tenantContext(tid)` call site and ~30 `{ tenantId }` literals. Make it **optional**.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bounded hierarchy traversal | A fresh recursive walker | Copy the `setManager` loop shape (depth cap + cursor) | Already battle-tested for cycle/DOS protection (D-11); consistent depth-cap semantics. |
| Branded-ID ↔ Convex `Id<>` bridge | Manual casts scattered in adapters | `_branded.ts` `brandedString` + `mappers.ts` toX/fromX | Established pattern; keeps casts at the adapter boundary only. |
| Event bus / subscriber isolation | A new dispatcher or `Promise.allSettled` reinvention | Harden the **existing** `EventDispatcher` (D-54) | One shared dispatcher; all subscribers benefit; matches the codebase's single-dispatcher convention. |
| By-reference audit | A new audit writer | Extend the audit subscriber pattern (`request-audit-subscriber.ts`) | `AuditLogRepositoryPort.create(ctx, {eventType, payload})` already exists; just add `approval.*` handlers. |
| In-memory test doubles | Mocks/stubs via vi.mock | In-memory fake repos (D-20) implementing the port | Service-first testing convention; fakes live in `adapters/memory/`. |

**Key insight:** Phase 5 is ~90% mechanical replication of patterns that already exist in `request/` and `directory/`. The genuinely new logic is small and pure: the resolver loop, two transition functions, and the action guards — all trivially unit-testable.

## Runtime State Inventory

> This is a code-extension phase (new module + additive fields), not a rename/migration. No external runtime systems store stale state. Two **schema additions** require attention.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `requestEvaluations` table gains a `requesterId` column (D-47/D-48). New tables `approvalChains` + `approvalTasks`. | Schema edit (`convex/schema.ts`) + mapper updates. **Pre-existing `requestEvaluations` rows will lack `requesterId`** — make the new column `v.union(v.string(), v.null())` (or `v.optional`) so old Phase 4 rows remain valid; the in-memory fake and mapper must tolerate `null`. No data backfill needed (Phase 4 produced test data only; verify in execution if any prod rows exist — STATE shows project is pre-release, so none expected). |
| Live service config | None — no n8n/Datadog/external orchestrators in this repo. Verified by directory scan: only `convex/` + `src/` + tests. | None. |
| OS-registered state | None — no Task Scheduler/launchd/pm2 registrations. Verified: no process-manager config in repo. | None. |
| Secrets/env vars | None added or renamed. `actorId` is a context field, not a secret. | None. |
| Build artifacts | `convex/_generated/` regenerates from `schema.ts` on `convex dev`/`deploy`. After adding tables, the generated `dataModel.d.ts`/`api.d.ts` update automatically. | Run `convex dev` (or the typecheck path) so `_generated` reflects the new tables before adapters typecheck. |

**Canonical question — after every file is updated, what runtime systems still have stale state?** Only the Convex datastore: existing `requestEvaluations` rows without `requesterId`. Mitigation: nullable column + null-tolerant mapper. Nothing else persists or registers Phase 5 strings.

## Common Pitfalls

### Pitfall 1: Making `TenantContext.actorId` required breaks the codebase
**What goes wrong:** Adding `readonly actorId: UserId` (non-optional) to `TenantContext` makes `tenantContext(tenantId)` and every `{ tenantId: ... }` literal a type error — there are ~30 such sites (audit subscribers build `{ tenantId: event.tenantId }`, all test fixtures use `tenantContext(tid)`).
**Why it happens:** `TenantContext` is constructed in many places; the existing `tenantContext` factory takes only `tenantId`.
**How to avoid:** Make `actorId` **optional** (`readonly actorId?: UserId`). Add an overload/second factory param: `tenantContext(tenantId, actorId?)`. In `submit()`, read `ctx.actorId` and pass to `evalRepo.create` as `requesterId` (which itself may be null for actor-less contexts). The audit subscribers that rebuild `{ tenantId: event.tenantId }` need no change.
**Warning signs:** `tsc --noEmit` floods with "Property 'actorId' is missing" across tests and audit subscribers.

### Pitfall 2: `requesterId` type — `UserId` from directory barrel, not a new brand
**What goes wrong:** Defining a separate `RequesterId` brand creates needless friction when comparing against `User.id` (a `UserId`) during the walk.
**How to avoid:** `RequestEvaluation.requesterId: UserId | null` — import `UserId` from `@/modules/directory/index.js`. The manager-walk compares `cursor.roleId === targetRoleId` and returns a `User` whose `.id` is the `approverId`. Keep types unified.
**Warning signs:** Casts between `RequesterId` and `UserId` in the resolver.

### Pitfall 3: Subscriber isolation must not swallow errors silently into a black hole (D-54)
**What goes wrong:** Wrapping handlers in `try/catch {}` with no recording means routing failures vanish — no audit, no observability, violating D-54's "record failure" clause.
**Why it happens:** "Isolate" is misread as "ignore."
**How to avoid:** The dispatcher's catch should **record** (e.g., collect failures, or invoke an optional `onError` hook) so the routing failure path can still emit `ApprovalRoutingFailed` + audit. Decide where `ApprovalRoutingFailed` is emitted: cleanest is **inside `ApprovalRoutingService`** (it catches its own `RoutingError`/`RoleNotFoundError`/`HierarchyTraversalError`, emits the failure event, and does not rethrow). The dispatcher hardening is then a *defense-in-depth* second layer for unexpected throws. Document this two-layer split in the plan.
**Warning signs:** A test that makes routing throw shows `submit()` still succeeds (good) but no audit record for the failure (bad).

### Pitfall 4: `EventDispatcher.emit` ordering/await semantics must be preserved
**What goes wrong:** Refactoring the `for...await` loop to `Promise.all` to add isolation changes the documented sequential-await semantics (tested in `event-dispatcher.test.ts` "awaits async handlers sequentially").
**How to avoid:** Keep the sequential `for (const h of handlers) { try { await h(event); } catch (e) { record; } }` shape. The existing 6 dispatcher tests must still pass; add ~2 new tests (a throwing handler does not stop the next; a throwing handler does not reject `emit`).
**Warning signs:** `event-dispatcher.test.ts` "calls handlers in registration order" / "awaits async handlers sequentially" go red.

### Pitfall 5: Idempotency on re-delivery / double-routing
**What goes wrong:** If `onRequestEvaluated` runs twice for the same `evaluationRecordId` (re-emit, retry), two chains get created.
**How to avoid:** Before materializing, `chainRepo.findByRequestEvaluationId(ctx, evaluationRecordId)` — if a chain already exists, no-op (idempotent). This is also why the reverse-lookup index on `requestEvaluationId` (D-09 discretion) matters. Mirror the existing tenant-scoped read pattern.
**Warning signs:** A test emitting the same event twice produces 2 `approvalChains`.

### Pitfall 6: convex/ HARD RULE leakage
**What goes wrong:** Putting the `decision.kind === "request-approval"` branch or the walk inside the Convex handler.
**How to avoid:** The handler only constructs repos, the dispatcher, the service, subscribes, and returns. All branching/walking lives in `ApprovalRoutingService`. ESLint's existing convex zones + the new approval zone enforce barrel-only access.

## Code Examples

### Adding the ESLint module-boundary zone (D-08)
```javascript
// Source: eslint.config.js — add to the `zones` array, mirroring the request zone
{
  target: "./src/modules/!(approval)/**/*",
  from: "./src/modules/approval/{domain,application,adapters}/**/*",
  except: ["**/approval/adapters/convex/mappers.ts"],
  message: "Cross-module deep imports forbidden. Import from '@/modules/approval' (barrel) instead — Module Boundary Rule (D-08)."
}
```

### Convex schema additions (D-09 tenant-prefixed + reverse-lookup indexes)
```typescript
// Source: convex/schema.ts — add two tables + extend requestEvaluations
requestEvaluations: defineTable({
  // ...existing fields...
  requesterId: v.union(v.string(), v.null()),   // D-47/D-48; nullable for pre-existing rows
  // ...
}). /* existing indexes */,

approvalChains: defineTable({
  tenantId: v.id("tenants"),
  requestEvaluationId: v.id("requestEvaluations"),
  status: v.string(),                            // IN_PROGRESS | APPROVED | REJECTED
  createdAt: v.number(),
})
  .index("by_tenant_created", ["tenantId", "createdAt"])
  .index("by_tenant_request_evaluation", ["tenantId", "requestEvaluationId"]),  // reverse lookup + idempotency

approvalTasks: defineTable({
  tenantId: v.id("tenants"),
  chainId: v.id("approvalChains"),
  stageNumber: v.number(),                       // always 1 in Phase 5
  approverId: v.string(),                        // resolved UserId snapshot
  approverRoleId: v.string(),                    // RoleId snapshot
  state: v.string(),                             // PENDING | APPROVED | REJECTED
  createdAt: v.number(),
})
  .index("by_tenant_chain", ["tenantId", "chainId"])   // tasks → chain (D-09 reverse lookup)
  .index("by_tenant_approver", ["tenantId", "approverId"]),  // approver inbox (Phase 6 readiness)
```
Note: `requestEvaluationId`/`chainId` use `v.id(...)` since they reference other Convex tables; `approverId`/`approverRoleId` are stored as plain branded strings (consistent with `policyVersions.createdBy: v.string()` in the existing schema).

### Approval event map + audit subscriber extension (D-53)
```typescript
// domain/approval-events.ts
export type ApprovalEventMap = {
  ApprovalTaskApproved: { tenantId: TenantId; taskId: ApprovalTaskId; chainId: ApprovalChainId; actorId: UserId; timestamp: number };
  ApprovalTaskRejected: { tenantId: TenantId; taskId: ApprovalTaskId; chainId: ApprovalChainId; actorId: UserId; timestamp: number };
  ApprovalRoutingFailed: { tenantId: TenantId; evaluationRecordId: RequestEvaluationId; reason: string; timestamp: number };
};
// audit subscriber — mirrors request-audit-subscriber.ts; eventType convention "<aggregate>.<action>":
//   approval.task_approved | approval.task_rejected | approval.routing_failed
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `EventDispatcher.emit` awaits each handler with no error isolation (a throw aborts the loop and bubbles to the emitter) | Per-handler `try/catch` that records and continues (D-54) | This phase | Subscriber failures no longer break `submit()` or sibling subscribers. Behavioral change only — no signature change. |
| `TenantContext = { tenantId }` | `{ tenantId, actorId? }` (D-48) | This phase | Optional field; threads requester identity to `RequestEvaluation.requesterId`. |
| `RequestEvaluation` has no requester identity | gains `requesterId: UserId \| null` (D-47/D-48) | This phase | Enables snapshot-based manager-walk decoupled from live execution context. |

**Deprecated/outdated:** None. All Phase 1-4 contracts remain intact; Phase 5 is strictly additive.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No production `requestEvaluations` rows exist yet (project pre-release per STATE.md), so no `requesterId` backfill is needed beyond a nullable column. | Runtime State Inventory | LOW — if prod rows exist, they'd simply have `requesterId = null` and be un-routable; surface to user if a backfill is desired. Mitigated by nullable column regardless. |
| A2 | Reusing the directory barrel's `RoleNotFoundError` (vs defining an approval-local one) is acceptable for SC#3. | Project Structure | LOW — purely a naming/ownership preference; either passes SC#3. Planner/discuss may confirm. |
| A3 | `ApprovalRoutingFailed` is best emitted from inside `ApprovalRoutingService` (catching its own routing errors), with dispatcher hardening as defense-in-depth. | Pitfall 3 | MEDIUM — D-54 allows "ApprovalRoutingFailed event / equivalent observability+audit record" but doesn't pin the emit site. If the user wants the dispatcher itself to emit a generic failure event, the wiring differs. Recommend confirming the two-layer split. |
| A4 | Module name `approval/` (not `routing/`). | Standard Stack / Structure | LOW — explicit Claude discretion; trivially renamed if user prefers `routing/`. |
| A5 | `actorId`/`requesterId` typed as `UserId` (directory brand), not a new `RequesterId` brand. | Pitfall 2 | LOW — unifies comparison with `User.id`; a separate brand is possible but adds casts. |

## Open Questions

1. **Where exactly does the Convex composition root subscribe the routing service?**
   - What we know: `convex/request.ts` `submitRequest` is the seam; it already builds the `requestDispatcher` and `RequestAuditSubscriber`.
   - What's unclear: whether routing subscribes inside the **same** `submitRequest` mutation (so routing runs synchronously within submit) or in a separate handler/scheduled function.
   - Recommendation: Subscribe inside `submitRequest` (synchronous, in-process — matches the existing audit subscriber and the "synchronous in-process by-reference" pattern). Because routing reads/writes Convex via the same `ctx.db`, it must run within the mutation's transaction. Plan should make the routing service's repos use the mutation `ctx.db` (same as `ConvexRequestEvaluationRepository`).

2. **Does routing run in the same Convex transaction as `submit()` (so a routing DB write commits atomically with the evaluation)?**
   - What we know: Convex mutations are transactional; the dispatcher fires synchronously inside the mutation handler.
   - What's unclear: D-54 says routing failure must NOT roll back the persisted `RequestEvaluation`. If routing runs in-transaction and throws, Convex would roll back the whole mutation — contradicting D-54.
   - Recommendation: **This is the key wiring decision.** Two options: (a) routing service swallows its own errors (emits `ApprovalRoutingFailed`, never throws) so the mutation commits — keeps D-54 with in-transaction execution; or (b) schedule routing as a separate Convex action/mutation after submit commits. Option (a) is simpler and matches A3. Flag for the planner: the dispatcher hardening (D-54) + service-level error swallowing together guarantee the evaluation persists. Recommend Option (a).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + TypeScript (strict) | All module code | ✓ | TS 5.x | — |
| Vitest | Validation Architecture | ✓ | 4.1.7 | — |
| Convex | Adapters + handlers + `_generated` | ✓ | installed | In-memory fakes cover all logic tests without a running Convex backend (D-20). |
| convex-helpers | `_branded.ts` bridge | ✓ | installed | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Convex backend is not required for the unit/service test suite — in-memory fakes exercise all routing + state-machine logic. Convex adapter tests (if added) need `convex dev`; the existing suite mostly tests via fakes.

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`). This section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.7 (v8 coverage) |
| Config file | `vitest.config.ts` (node env; `@` → `src` alias; include `tests/**/*.test.ts` + `src/**/*.test.ts`) |
| Quick run command | `npx vitest run tests/modules/approval --reporter=dot` |
| Full suite command | `npm test` (`vitest run --reporter=dot`) |
| Coverage command | `npm run test:coverage` |

**Coverage targets (from `docs/engineering.md` + `vitest.config.ts`):**
- `docs/engineering.md` line 42 names **"Approval Workflow Generation: 100%"** — stricter than the 90% in the context. Treat routing resolution + state machine as 100% targets.
- Global threshold is 90% lines/functions/branches/statements; `src/modules/runtime/**` is pinned at 100%. Recommend adding `src/modules/approval/**` at 100% (matching the runtime pin) given the engineering-doc mandate.
- Coverage **excludes** `index.ts` barrels and `adapters/convex/**` (per `vitest.config.ts`) — so the 100% applies to domain + application + memory adapters, which the in-memory-fake tests fully exercise.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEC-03 | `request-approval` decision → chain+task materialized; non-request-approval ignored | unit (service + fakes) | `npx vitest run tests/modules/approval/routing-service.test.ts` | ❌ Wave 0 |
| DEC-03 | SC#1: `request/` has no import of `approval/` (runtime stays agnostic) | static (eslint + grep) | `npm run lint` + `! grep -r "modules/approval" src/modules/request` | ❌ Wave 0 (add assertion test) |
| DEC-03 (D-49) | Walk hit: ancestor holds targetRoleId → that user is approver | unit | same file, `describe("resolveApprover")` | ❌ Wave 0 |
| DEC-03 (D-49) | Walk miss: chain ends, no holder → `RoutingError`, no task created | unit | same | ❌ Wave 0 |
| DEC-03 (D-49) | Self-exclusion: requester holds role but is start → not selected; walks from `managerId` | unit | same | ❌ Wave 0 |
| DEC-03 (D-50) | Depth cap: >50 hops → `HierarchyTraversalError` | unit | same | ❌ Wave 0 |
| DEC-03 (D-50/SC#3) | Missing `targetRoleId` in registry → `RoleNotFoundError`, no walk | unit | same | ❌ Wave 0 |
| DEC-03 (D-51) | Task transitions: PENDING→APPROVED, PENDING→REJECTED; terminal states reject further | unit (pure) | `npx vitest run tests/modules/approval/state-machine.test.ts` | ❌ Wave 0 |
| DEC-03 (D-51) | Chain status derivation: any REJECTED→REJECTED; all APPROVED→APPROVED; else IN_PROGRESS | unit (pure) | same | ❌ Wave 0 |
| DEC-03 (D-52) | Auth guard: non-approver acting → `UnauthorizedApproverError` | unit | routing-service.test.ts `describe("act")` | ❌ Wave 0 |
| DEC-03 (D-52) | Idempotency: acting on terminal task → `TaskAlreadyResolvedError` | unit | same | ❌ Wave 0 |
| DEC-03 (D-44) | Immutability: changing `managerId` after creation does not alter stored `approverId` | unit | same | ❌ Wave 0 |
| DEC-03 (idempotency) | Same `evaluationRecordId` emitted twice → one chain | unit | same | ❌ Wave 0 |
| DEC-03 (D-53) | Approve/Reject emits `ApprovalTaskApproved/Rejected`; audit subscriber writes by-reference (no content) | unit | `npx vitest run tests/modules/approval/approval-audit-subscriber.test.ts` | ❌ Wave 0 |
| DEC-03 (D-54) | Throwing subscriber does not stop sibling subscribers; `emit` does not reject | unit | extend `tests/modules/policy/event-dispatcher.test.ts` (+2 cases) | ⚠️ partial (file exists, add cases) |
| DEC-03 (D-54) | Routing failure → `ApprovalRoutingFailed` emitted + audited; `RequestEvaluation` still persisted | unit | routing-service.test.ts | ❌ Wave 0 |
| DEC-03 (D-48) | `submit()` threads `ctx.actorId → RequestEvaluation.requesterId` | unit | extend `tests/modules/request/policy-runtime-service.test.ts` | ⚠️ partial (file exists, add cases) |
| CON-01 | Cross-tenant: chain/task reads filtered by `ctx.tenantId` | unit | routing-service.test.ts + repo fakes | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/modules/approval --reporter=dot` (fast, fakes-only).
- **Per wave merge:** `npm test` (full suite — ensures the `EventDispatcher`, `TenantContext`, and `RequestEvaluation` ripples didn't regress Phase 1-4).
- **Phase gate:** `npm run test:coverage` green with approval module at 100% (domain+application+memory) before `/gsd:verify-work`. Plus `npm run lint` (new ESLint zone enforced) + `tsc --noEmit`.

### Wave 0 Gaps
- [ ] `tests/modules/approval/routing-service.test.ts` — covers DEC-03 walk/auth/idempotency/immutability/failure
- [ ] `tests/modules/approval/state-machine.test.ts` — covers D-51 transition tables (pure)
- [ ] `tests/modules/approval/approval-audit-subscriber.test.ts` — covers D-53 by-reference audit
- [ ] `tests/_helpers/in-memory-fakes.ts` — extend `setupRequest` (or add `setupApproval`) to wire the routing service + chain/task fakes + approval dispatcher
- [ ] `tests/_helpers/*` — manager-hierarchy fixture builder (users with `managerId`/`roleId` graphs → expected approver tuples)
- [ ] Extend `tests/modules/policy/event-dispatcher.test.ts` — +2 isolation cases (D-54)
- [ ] Extend `tests/modules/request/policy-runtime-service.test.ts` — actorId→requesterId threading (D-48)
- [ ] Framework install: none — Vitest already present.

## Sources

### Primary (HIGH confidence) — all in-repo, verified this session
- `src/shared/event-dispatcher.ts` — current emit loop (D-54 target)
- `src/modules/request/application/policy-runtime-service.ts` — `submit()` emit seam (line 62), actorId threading point
- `src/modules/request/domain/{request-evaluation,request-events,ids}.ts` — entity + event + branded-ID templates
- `src/modules/request/ports/`, `adapters/{memory,convex}/`, `index.ts` — port/fake/adapter/barrel templates
- `src/modules/directory/application/user-service.ts` (lines 88-107) — bounded manager-walk template
- `src/modules/directory/{domain/{user,role,ids},ports,application/tenant-context}.ts`, `index.ts` — walk inputs + TenantContext + barrel
- `src/modules/runtime/domain/decision.ts` — `Decision` union (read-only, do not modify)
- `src/modules/audit/application/{request-audit,audit-event}-subscriber.ts`, `ports/audit-log-repository.port.ts`, `index.ts` — by-reference audit template
- `convex/schema.ts`, `convex/request.ts`, `convex/_branded.ts` — schema/index pattern, thin-DI handler, branded bridge
- `eslint.config.js` — `import/no-restricted-paths` zone pattern
- `vitest.config.ts`, `package.json`, `tests/_helpers/*`, `tests/modules/policy/event-dispatcher.test.ts` — test infra + coverage thresholds
- `docs/engineering.md` (lines 35-53) — Vitest stack; "Approval Workflow Generation: 100%"; "Critical Business Logic: 90%+"
- GitNexus `impact EventDispatcher --direction upstream` — risk LOW, 3 direct callers (`setupPolicy`, `setupRequest`, `convex/request.ts`), 1 process affected. Index fresh (indexedAt matches HEAD `4201116`).

### Secondary (MEDIUM confidence)
- GitNexus `impact TenantContext`/`RequestEvaluation` returned 0 nodes (interfaces not tracked as call-graph classes) — type-level ripple instead established by grep (`tenantContext(` / `{ tenantId` callsites enumerated; ~30 sites, all using the factory or rebuilding `{ tenantId }`, none break under an **optional** `actorId`).

### Tertiary (LOW confidence)
- None. No external/web sources needed; this phase is pure in-repo pattern replication.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; all libs verified present in repo.
- Architecture: HIGH — every pattern has an exact in-repo template; subscription seam, walk, and state machine all directly mirror existing code.
- Pitfalls: HIGH — derived from reading the actual `TenantContext`/`EventDispatcher`/schema and the D-54 transaction tension (Open Question 2), not speculation.
- Ripple/blast radius: HIGH for EventDispatcher (GitNexus confirmed LOW risk, 3 callers); HIGH for type ripples (grep-enumerated, additive/optional).

**GitNexus mandate (CLAUDE.md):** `gitnexus_impact` run on `EventDispatcher` (LOW, 3 direct callers — `setupPolicy`, `setupRequest`, `convex/request.ts`). D-54 is additive (no signature change), so the blast radius is behavioral; existing 6 dispatcher tests must stay green + 2 new isolation tests. `TenantContext` and `RequestEvaluation` are interface types (0 call-graph nodes); their ripple is type-level and additive — making `actorId`/`requesterId` optional/nullable keeps all ~30 construction sites valid. Planner must still run `gitnexus_detect_changes()` pre-commit and `gitnexus_impact` before editing any concrete symbol it touches.

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (stable — in-repo patterns; refresh only if Phase 1-4 source changes materially)
