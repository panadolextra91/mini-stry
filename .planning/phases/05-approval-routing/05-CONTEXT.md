# Phase 5: Approval Routing (Reference Decision Consumer) - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 ships the **first reference Decision Consumer**: `ApprovalRoutingService`. It demonstrates the runtime's downstream pluggability by turning a **Request-Approval Decision** (emitted by the Phase 4 runtime) into a persisted, sequential approval task chain with a deterministic Approve/Reject state machine.

**The flow:**
```
PolicyRuntimeService.submit() persists RequestEvaluation + emits "RequestEvaluated"
  → ApprovalRoutingService subscribes (via EventDispatcher; runtime has NO compile-time dep on it — SC#1)
  → fetch RequestEvaluation by evaluationRecordId → read decision + requesterId
  → if decision.kind === "request-approval":
       validate targetRoleId exists in Role registry          [SC#3]
       walk requester.managerId chain → first ancestor holding targetRoleId  [SC#2]
       materialize ApprovalChain + one ApprovalTask (stageNumber = 1)        [SC#4]
  → approver (== task.approverId) acts Approve/Reject → deterministic task + chain transitions  [SC#5]
  → every transition emits approval.* event → AuditLog by-reference
```

**Phase 5 IS:**
- A new application service `ApprovalRoutingService` in a new module (`approval/` or `routing/` — Claude discretion), mirroring the Phase 1-4 Hexagonal module skeleton.
- Two new operational domain entities + Convex tables: **`ApprovalChain`** (`id`, `requestEvaluationId`, `status`) and **`ApprovalTask`** (`chainId`, `stageNumber`, `approverId`, `approverRoleId`, `state`) — D-46.
- A manager-chain resolver that walks `User.managerId` upward to find the first ancestor holding `targetRoleId` — D-43, D-45, D-49.
- A single-task approval chain generator + a deterministic Approve/Reject state machine whose entities/ordering support future multi-stage without schema replacement — D-46, D-51.
- Extending `RequestEvaluation` with `requesterId` (sourced from `TenantContext.actorId`) — D-47, D-48.
- Hardening the shared `EventDispatcher` so subscriber failures are isolated and never bubble into request submission — D-54.
- Requirement delivered: **DEC-03** (reference Decision Consumer — approval routing).

**Phase 5 IS NOT:**
- A change to the runtime, the `Decision` discriminated union, or the `RequestEvaluatedEvent` payload (stays `evaluationRecordId` only — D-47). The runtime stays agnostic to consumers (SC#1).
- **Multi-stage / multi-role chains.** Phase 5 chains contain exactly one task (`stageNumber = 1`). Multi-stage workflows involving multiple roles are **deferred** to a future policy model and must be *explicitly declared by policy*, never inferred from hierarchy depth — D-45, D-46.
- **Intermediate managers as approvers.** Managers between requester and the role-holder are NOT stages — D-45.
- Fallback approvers, implicit CEO escalation, parallel stages, branching, retries, or deadlines — D-43, D-46.
- UI for inbox / approve / reject (Phase 6, UI-03). Phase 5 exposes services + thin Convex handlers, not React.
- Notifications / webhooks on chain completion (v2 Decision Consumers).

</domain>

<decisions>
## Implementation Decisions

### Chain Construction (Area 1)

- **D-43 — Strict manager-chain resolution.** Walk `managerId` upward; resolve to the **first ancestor holding `targetRoleId`**. If found → create the approval stage. If the chain terminates without a match → throw `RoutingError`: **no `ApprovalTask` is created, no fallback approver, no implicit CEO escalation.** Emit a lightweight audit event for observability and surface the error. Role requirements are authoritative and are never silently substituted.
- **D-44 — Resolve once at creation, immutable snapshot.** The full approval chain is resolved **once** when the Request-Approval Decision is consumed, then materialized + persisted. Stored stage data: `stageNumber`, `approverId`, `approverRoleId`. Approval chains are **immutable after creation** — later changes to `managerId`, role assignments, or org hierarchy do NOT affect already-created flows. Preserves deterministic replay, auditability, historical correctness.
- **D-45 — Only the resolved role-holder is a stage.** Intermediate managers do NOT automatically become approvers. Org hierarchy determines WHO holds a role; policy determines WHICH role is required. Multi-role multi-stage workflows are deferred and must be explicitly declared by policy, not inferred from hierarchy depth.
- **D-46 — `ApprovalChain` + `ApprovalTask` are separate entities.**
  - `ApprovalChain` owns: `id`, `requestEvaluationId`, `status`.
  - `ApprovalTask` owns: `chainId`, `stageNumber`, `approverId`, `approverRoleId`, `state`.
  - Phase 5 execution: chains contain exactly **one** task, `stageNumber = 1`. Ordering/gating infrastructure exists conceptually through `stageNumber` + task state transitions. No parallel stages, branching, escalation, retries, or deadlines. Future phases can extend `ApprovalChain` **without schema replacement**.

### Decision Hand-off (Area 2)

- **D-47 — `RequestEvaluatedEvent` stays minimal.** Payload remains `evaluationRecordId` (+ existing `tenantId`/`timestamp`). Consumers fetch the `RequestEvaluation` through repositories; Decision/Trace data is **never duplicated into events**. `RequestEvaluation` gains a `requesterId` field. `ApprovalRoutingService` resolves: `evaluationRecordId → RequestEvaluation → requesterId + decision → routing`.
- **D-48 — Requester identity from `TenantContext.actorId`.** During request submission, `ctx.actorId → RequestEvaluation.requesterId` (persisted as request metadata). `EvaluationContext` remains domain-neutral and does NOT contain `requesterId`. `ApprovalRoutingService` walks manager chains using the **snapshotted** `RequestEvaluation.requesterId`, not the current execution context.

### Approver Resolution (Area 3)

- **D-49 — Walk starts at `requester.managerId` (self excluded).** Algorithm:
  ```
  cursor = requester.managerId
  while (cursor != null) {
    if (cursor.roleId === targetRoleId) return cursor;   // approver
    cursor = cursor.managerId;
  }
  throw RoutingError;
  ```
  Requester never self-approves, even if they hold `targetRoleId`. Approver is a **specific resolved user** (`approverId`), not a role-bucket.
- **D-50 — Pre-routing validation + defensive depth cap.**
  1. Validate `targetRoleId` exists in the tenant Role registry (`roleRepo.findById`); if missing → `RoleNotFoundError` (satisfies SC#3).
  2. Walk the hierarchy with a defensive depth limit `MAX_HIERARCHY_DEPTH = 50`; if exceeded → `HierarchyTraversalError`.
  - The depth cap is a **safety guard, not a business rule**. D-11 (`managerId` cycle prevention at write-time in `UserService.setManager`) remains the primary protection. The cap defends against corrupted hierarchy data, migration mistakes, and future regressions.

### Reject & State Machine (Area 4)

- **D-51 — Deterministic state machines.**
  - `ApprovalTask`: `PENDING → APPROVED` | `PENDING → REJECTED`. APPROVED and REJECTED are terminal; no further transitions.
  - `ApprovalChain`: `IN_PROGRESS → APPROVED` | `IN_PROGRESS → REJECTED`. Chain becomes APPROVED when **all** tasks are APPROVED; REJECTED when **any** task is REJECTED. Rejection **immediately terminates** the chain — no subsequent tasks execute.
  - Phase 5: a chain has exactly one task, so the task outcome directly determines the chain outcome. The same state machine remains valid for future multi-stage with no schema changes.
- **D-52 — Authorization + idempotency on actions.** Only the user matching `task.approverId` (compared against `ctx.actorId`, per D-48) may Approve/Reject. Guards:
  ```
  act(ctx, taskId, action) {
    if (task.state !== PENDING) throw TaskAlreadyResolvedError;   // double-action / terminal guard
    if (ctx.actorId !== task.approverId) throw UnauthorizedApproverError;
    ...
  }
  ```
- **D-53 — Approval actions are auditable.** On `PENDING → APPROVED` / `PENDING → REJECTED`, the service emits `ApprovalTaskApproved` / `ApprovalTaskRejected` with payload `{ tenantId, taskId, chainId, actorId, timestamp }`. `AuditEventSubscriber` consumes these and writes `AuditLog` entries **by-reference** (`eventType`, `taskId`, `actorId`, `timestamp` — never content). `ApprovalTask`/`ApprovalChain` are the operational source of truth; `AuditLog` is the governance ledger only (consistent with D-37).

### Consumer ↔ Runtime Error Isolation

- **D-54 — Subscriber failures isolated by `EventDispatcher`.** The shared dispatcher wraps each subscriber so that:
  - A failing subscriber must NOT prevent other subscribers from executing.
  - Subscriber failures must NOT bubble back into request submission.
  - Runtime evaluation and approval routing remain decoupled (SC#1).
  ```
  for each subscriber: try execute; catch error: record failure; continue
  ```
  Routing failures (`RoutingError`, `RoleNotFoundError`, `HierarchyTraversalError`) produce an `ApprovalRoutingFailed` event / equivalent observability+audit record. `RequestEvaluation` remains persisted and valid even if routing later fails.

### Claude's Discretion
The planner/researcher may pick concrete approaches consistent with the decisions above:
- **Module naming/placement** — `approval/` vs `routing/`; the standard `{domain, application, ports, adapters, index.ts, README.md}` skeleton; barrel-only imports (D-08) with a new ESLint `no-restricted-paths` zone. `Decision`/`RequestEvaluation` come from other modules' barrels — no deep imports.
- **Branded IDs** — `ApprovalChainId`, `ApprovalTaskId` owned by the new module (Phase 1 branded-ID pattern); `status`/`state` as small string unions.
- **Convex tables + indexes** — `approvalChains`, `approvalTasks` with tenant-prefixed composite indexes (D-09); plus a reverse-lookup index on `requestEvaluationId` (chain → request) and `chainId` (tasks → chain). Thin DI handlers only (convex/ HARD RULE).
- **Where routing subscribes** — wiring `ApprovalRoutingService` onto `EventDispatcher.on("RequestEvaluated", ...)` at the composition root (Convex handler / DI assembly).
- **Event/error constant names** — exact strings for `ApprovalTaskApproved`/`ApprovalTaskRejected`/`ApprovalRoutingFailed` and the `approval.*` audit `eventType` convention (`<aggregate>.<action>`, e.g. `approval.task_approved`, `approval.routing_failed`).
- **`TenantContext.actorId` typing** — optional vs required; how submit threads it into `RequestEvaluation.requesterId`.
- **Test fixtures** — manager-hierarchy graphs → expected chain/approver tuples; state-machine transition tables; in-memory repositories per D-20.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or implementing.**

### Vision & Architecture
- `.planning/PROJECT.md` — runtime formula, Concept Hierarchy (**Decision Consumers = #6**, external to the runtime), Hexagonal + Modular Monolith, domain-neutrality constraint, "Decision Consumers Are External to the Runtime" Key Decision (SC#1 anchor), "Manager Cycle Depth Limit" (`MAX_MANAGER_CHAIN_DEPTH = 50`), "convex/ HARD RULE" (thin DI only).
- `.planning/PROJECT.md` §"Constraints" — `TenantContext` MUST be the first parameter of every application service method; no ambient resolution. (`ApprovalRoutingService` follows; `actorId` joins `tenantId` on the context per D-48.)

### Requirements (Active for Phase 5)
- `.planning/REQUIREMENTS.md` §DEC (**DEC-03**) — reference Decision Consumer (Approval Routing): convert Request-Approval Decisions into sequential multi-stage approval chains; runtime has no compile-time dependency on it.
- `.planning/REQUIREMENTS.md` §CON (**CON-04**) — supervisor reporting lines (`managerId` / reports-to) used to resolve relative hierarchy paths. Validated in Phase 1; consumed here.

### Phase Plan & Success Criteria
- `.planning/ROADMAP.md` §"Phase 5: Approval Routing (Reference Decision Consumer)" — goal, dependency (Phase 4), 5 success criteria, plan breakdown (05-01 role + supervisor resolvers, 05-02 sequential task generator + approval state machine). **Note:** SC#4 ("sequential multi-stage") is satisfied at the entity/state-machine level (D-46/D-51); single-task execution per D-45/D-46. Multi-stage data is deferred — flag for the verifier so it is not reported as a gap.

### Phase 4 Request Runtime (the producer being consumed — HARD constraints)
- `.planning/phases/04-request-runtime/04-CONTEXT.md` — D-38 (`RequestEvaluation` operational table — Phase 5 adds `requesterId`), D-40/D-41 (failure paths), D-42 (replay strategy), D-37 (audit by-reference).
- `src/modules/request/application/policy-runtime-service.ts` — `submit()` emits `"RequestEvaluated"` (line 62) before `return record`; Phase 5 subscribes here. `submit()` must thread `ctx.actorId → RequestEvaluation.requesterId` (D-48).
- `src/modules/request/domain/request-events.ts` — `RequestEvaluatedEvent` stays `{ tenantId, evaluationRecordId, timestamp }` (D-47, no change).
- `src/modules/request/domain/request-evaluation.ts` — add `requesterId` field (D-47/D-48); ripples to the Convex `requestEvaluations` table + mappers + in-memory fake.

### Runtime / Decision (read-only consumption — HARD constraints)
- `src/modules/runtime/domain/decision.ts` — `Decision` discriminated union; `request-approval` carries a single `targetRoleId: RoleId` (lines 6-9). **Do not modify** (SC#1). This single role is the routing gate (D-43).
- `src/modules/runtime/index.ts` — public barrel (`Decision`, `EvaluationContext`, etc.).

### Directory / Manager Hierarchy (resolution source — HARD constraints)
- `src/modules/directory/domain/user.ts` — `User.managerId: UserId | null`, `User.roleId: RoleId` — the walk inputs (D-49).
- `src/modules/directory/domain/role.ts` — `Role` registry entity; validate `targetRoleId` against it (D-50, SC#3).
- `src/modules/directory/application/user-service.ts` — `setManager()` (lines 69-110) already enforces `MAX_MANAGER_CHAIN_DEPTH = 50` cycle prevention (D-11, primary protection); Phase 5 walk reuses the cap defensively as `MAX_HIERARCHY_DEPTH = 50` (D-50).
- `src/modules/directory/index.ts` — public barrel (`User`, `Role`, `UserId`, `RoleId`, `TenantContext`, `tenantContext`, repository ports). `TenantContext` gains `actorId` (D-48) — ripples to `tenant-context.ts`.

### Events & Audit (patterns to reuse + harden)
- `src/shared/event-dispatcher.ts` — **D-54 modifies this**: wrap each handler in try/catch (record failure, continue) so a failing subscriber neither breaks the emit loop nor bubbles into `submit()`. **Touches Phase 3 + Phase 4 audit subscribers — run `gitnexus_impact({target: "EventDispatcher", direction: "upstream"})` first.**
- `src/modules/audit/application/audit-event-subscriber.ts` + `src/modules/audit/index.ts` — by-reference audit subscriber pattern (D-35/D-37) to extend for `approval.*` events (D-53) and the `ApprovalRoutingFailed` observability event (D-54).

### Phase 1 Foundations (inherited contracts — HARD constraints)
- `.planning/phases/01-core-platform-foundations/01-CONTEXT.md` — D-08 (Module Boundary Rule: barrel-only imports + ESLint `no-restricted-paths` zone for the new module), D-09 (tenant-prefixed Convex indexes), D-13 (entities = plain TS interfaces), D-14/D-15 (branded string IDs owned by defining module), D-18 (constructor-injected ports), D-19 (`TenantContext` first parameter), D-20 (service-first testing with in-memory fakes).

### Engineering Standards (HARD constraints)
- `docs/engineering.md` §"Testing Requirements" — 90%+ coverage on critical business logic (routing resolution + state machine qualify); Vitest stack since Phase 1.
- `docs/engineering.md` §"Code Quality" — TS strict, no `any`, no `eval()`, pure deterministic logic.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`EventDispatcher` + `AuditEventSubscriber`** (`src/shared/event-dispatcher.ts`, `src/modules/audit/`) — the synchronous in-process by-reference audit pattern. Phase 5 (a) adds `approval.*` handlers in the same shape (D-53) and (b) hardens the dispatcher for subscriber isolation (D-54).
- **`PolicyRuntimeService.submit()`** (`src/modules/request/application/policy-runtime-service.ts`) — emits `"RequestEvaluated"`; the exact subscription seam for `ApprovalRoutingService`. Also the place `ctx.actorId` is threaded into `requesterId` (D-48).
- **Manager-walk template** — `UserService.setManager()` already implements a bounded `managerId` traversal loop with `MAX_MANAGER_CHAIN_DEPTH = 50`; the routing resolver mirrors this traversal shape (D-49/D-50).
- **Module skeleton** — `directory/`, `runtime/`, `policy/`, `request/`, `audit/` all share `{domain, application, ports, adapters, index.ts, README.md}`. The new approval/routing module mirrors this exactly.
- **Branded-ID + custom-error + Convex-adapter patterns** — `src/modules/*/domain/ids.ts`, `*/application/errors.ts`, `*/adapters/convex/` (+ `_branded.ts` bridge) and `adapters/memory/` fakes are the templates for `ApprovalChainId`/`ApprovalTaskId`, the new error classes, and the chain/task repositories.

### Established Patterns
- **D-08 ESLint zones** — `eslint.config.*` has `import/no-restricted-paths` zones per module; Phase 5 MUST add one for the new module. The new module imports `Decision`/`RequestEvaluation`/`User`/`Role` only via barrels.
- **Tenant-prefixed Convex indexes (D-09)** — `approvalChains` / `approvalTasks` prefix indexes with `tenantId`; add reverse-lookup indexes (`requestEvaluationId`, `chainId`).
- **ES module `.js` import extensions** — Node ESM convention throughout (`from "./ids.js"`).
- **Application-layer invariants** — services enforce business rules (e.g., role uniqueness) in the service layer, not via DB constraints; state-machine guards (D-52) follow the same approach.

### Integration Points
- **`TenantContext` gains `actorId`** (D-48) — schema/type change in `directory/application/tenant-context.ts`; ripples to every call site that constructs a context (run impact analysis). Submit reads `ctx.actorId`.
- **`RequestEvaluation` + `requestEvaluations` table gain `requesterId`** (D-47/D-48) — touches Phase 4 entity, mappers, Convex schema, and in-memory fake.
- **`EventDispatcher.emit` semantics change** (D-54) — affects ALL existing subscribers (Phase 3 policy audit, Phase 4 request audit). MANDATORY `gitnexus_impact` before editing.
- **Composition root wiring** — `ApprovalRoutingService` needs the chain/task repositories, the `RoleRepositoryPort` + `UserRepositoryPort` (manager walk), and the `EventDispatcher` injected via constructor (D-18); subscribed to `"RequestEvaluated"` in thin Convex DI assembly.

</code_context>

<specifics>
## Specific Ideas

- **The runtime stays blind to the consumer.** `Decision` and `RequestEvaluatedEvent` are unchanged; routing reads everything it needs from the persisted `RequestEvaluation` (D-47). This is the concrete proof of SC#1 / the "Decision Consumers are external" Key Decision.
- **"Org hierarchy decides WHO holds a role; policy decides WHICH role is required"** (D-45) — the clean separation that keeps routing domain-neutral. The Decision's single `targetRoleId` is a *gate*, resolved against live org structure at chain-creation time.
- **Snapshot, not live** (D-44) — chains are immutable; a later re-org never rewrites an in-flight approval. Mirrors the Phase 4 replay/immutability ethos.
- **Strict, no silent substitution** (D-43) — unresolvable chains fail loudly (`RoutingError`) with no fallback/CEO escalation; the role requirement is authoritative.
- **One state machine, one task today, N tasks tomorrow** (D-46/D-51) — `stageNumber` + terminal transitions are designed so future multi-stage drops in without schema replacement.

</specifics>

<deferred>
## Deferred Ideas

These surfaced as natural follow-ons. None are scope creep — they belong to other phases or v2.

- **Multi-stage / multi-role approval chains** — explicitly deferred to a future *policy-declared* model (D-45/D-46). Must be declared by policy, never inferred from hierarchy depth. The entities/state machine already support it without schema replacement.
- **Parallel stages, branching, escalation, retries, deadlines** — out of scope for Phase 5 (D-46).
- **Fallback approvers / implicit CEO escalation** — explicitly rejected (D-43). Unresolvable chains fail with `RoutingError`.
- **Notifications / webhooks on chain completion** — future Decision Consumers (v2). Phase 5 stops at persisting chain/task state + audit.
- **Approver inbox UI + Approve/Reject actions UI** — Phase 6 (UI-03). Phase 5 exposes services + thin Convex handlers only.
- **Role-bucket claims** (any holder of `approverRoleId` can act) — rejected for Phase 5 (D-49/D-52 resolve a specific `approverId`). Could revisit if delegation/claim semantics are needed later.

</deferred>

---

*Phase: 5-Approval Routing (Reference Decision Consumer)*
*Context gathered: 2026-06-03*
