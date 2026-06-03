# Phase 5: Approval Routing (Reference Decision Consumer) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 5-Approval Routing (Reference Decision Consumer)
**Areas discussed:** Chain construction, Decision hand-off, Approver resolution, Reject & state machine, Consumer↔runtime error isolation

---

## Area 1 — Chain Construction

### Q1: Chain model

| Option | Description | Selected |
|--------|-------------|----------|
| Walk managerId chain | Start at requester, climb managerId; each hop a stage; stop at first ancestor holding targetRoleId (role = terminal gate) | ✓ |
| Ordered role sequence | Stages defined by an ordered role list; requires extending Decision / routing config | |
| Hybrid: walk + role gate | Climb managerId but each stage must satisfy a role requirement | |

**User's choice:** Walk managerId chain — targetRoleId = terminal gate, each managerId hop = a sequential stage.

### Q2: No-gate termination & Q3: Resolve time

| Option | Description | Selected |
|--------|-------------|----------|
| No-gate → throw RoutingError, no task | Chain exhausted without match = precondition failure; no task, no fallback, no CEO escalation; lightweight audit; surface error | ✓ (→ D-43) |
| No-gate → top-most manager as final stage | Fall back to CEO | |
| No-gate → chain with no gate | Every hop a stage, role ignored | |
| Resolve time: snapshot at creation | Resolve full graph once, materialize immediately; immutable; deterministic replay | ✓ (→ D-44) |
| Resolve time: lazy per stage | Resolve next stage only when prior approved | |

**User's choice:** Authored **D-43** (strict resolution, no fallback/escalation) and **D-44** (resolve once at creation, immutable snapshot of stageNumber/approverId/approverRoleId).

### Q4 (clarification): Are intermediate managers stages?

| Option | Description | Selected |
|--------|-------------|----------|
| Each manager hop = 1 stage | All managers up to & including role-holder are sequential stages | (initially implied by preview) |
| Only role-holder is a single stage | Skip intermediate managers; first targetRoleId holder is the sole approver | ✓ (→ D-45) |

**User's choice:** Authored **D-45** — only the resolved role-holder becomes a stage; intermediate managers are NOT approvers; multi-role multi-stage deferred to a future policy-declared model. Then authored **D-46** — `ApprovalChain` + `ApprovalTask` separate entities; Phase 5 chains contain exactly one task (`stageNumber=1`); ordering/gating infra conceptual; multi-stage extensible without schema replacement.

**Notes:** Resolved the apparent tension with ROADMAP SC#4 ("sequential multi-stage") — satisfied at the entity/state-machine level with single-task execution; multi-stage data deferred.

---

## Area 2 — Decision Hand-off

### Q1: How consumer accesses the Decision & Q2: Requester identity source

| Option | Description | Selected |
|--------|-------------|----------|
| Subscribe RequestEvaluated + fetch record | Consumer fetches RequestEvaluation by id via repo; runtime/event unchanged | ✓ (→ D-47) |
| Enrich event payload with decision | Add decision + requesterId to RequestEvaluatedEvent | |
| Requester id: TenantContext.actorId | actorId → RequestEvaluation.requesterId at submit; EvaluationContext stays domain-neutral | ✓ (→ D-48) |
| Requester id: field in EvaluationContext | Caller puts requesterId in requestInput | |

**User's choice:** Authored **D-47** (event stays minimal `evaluationRecordId`; consumers fetch record; `RequestEvaluation` gains `requesterId`; no Decision/Trace duplication into events) and **D-48** (`requesterId ← TenantContext.actorId` at submit; routing uses snapshotted record, not current execution context).

---

## Area 3 — Approver Resolution

### Q1: Walk start / self-approval & Q2: Role validation + depth cap

| Option | Description | Selected |
|--------|-------------|----------|
| Start at direct manager, exclude requester | Walk from requester.managerId; requester never self-approves | ✓ (→ D-49) |
| Include requester before climbing | Requester can self-satisfy if holding role | |
| Validate role exists + reuse cap 50 | roleRepo.findById before walk; bound walk at MAX depth 50 | ✓ (→ D-50) |
| Skip role validation, no cap | Trust Decision; rely on write-time cycle prevention | |

**User's choice:** Authored **D-49** (walk from `requester.managerId`, exhausted → `RoutingError`) and **D-50** (validate `targetRoleId` exists → `RoleNotFoundError`; defensive `MAX_HIERARCHY_DEPTH = 50` → `HierarchyTraversalError`; cap is a safety guard, D-11 cycle prevention is primary).

---

## Area 4 — Reject & State Machine

### Q1: State set & reject semantics, Q2: Authorization/idempotency, Q3: Audit

| Option | Description | Selected |
|--------|-------------|----------|
| Task PENDING→APPROVED/REJECTED; reject terminates chain | Deterministic; any reject halts chain; gating Stage N+1 ⇐ Stage N approved | ✓ (→ D-51) |
| Reject affects only that stage | Retry/send-back allowed | |
| Only matching approverId; terminal → reject | actorId === task.approverId; non-PENDING → TaskAlreadyResolvedError; wrong approver → UnauthorizedApproverError | ✓ (→ D-52) |
| Any holder of approverRoleId | Role-bucket claim | |
| Emit approval.* events → AuditLog by-reference | Reuse EventDispatcher + AuditEventSubscriber | ✓ (→ D-53) |
| No audit in Phase 5 | State change only | |

**User's choice:** Authored **D-51** (Task + Chain state machines; any reject terminates chain immediately; same machine valid for future multi-stage), selected the recommended authorization/idempotency option → **D-52** (only `task.approverId`===`ctx.actorId` may act; terminal/double-action guards), and authored **D-53** (emit `ApprovalTaskApproved`/`Rejected` → `AuditEventSubscriber` writes AuditLog by-reference; Task/Chain operational source, AuditLog governance only).

---

## Extra Area — Consumer ↔ Runtime Error Isolation

### Q: Where is the consumer's error boundary?

| Option | Description | Selected |
|--------|-------------|----------|
| Subscriber self-isolates (try/catch at subscriber) | Routing catches own errors, emits audit, never rethrows | |
| Harden EventDispatcher to isolate all subscribers | Dispatcher wraps each handler; record failure, continue | ✓ (→ D-54) |
| Let errors bubble into submit() | Synchronous propagation; couples runtime to consumer | |

**User's choice:** Authored **D-54** — subscriber failures isolated **by the EventDispatcher**: a failing subscriber neither blocks other subscribers nor bubbles into request submission; routing failures emit `ApprovalRoutingFailed`/audit; `RequestEvaluation` stays persisted and valid. (Surfaced the integration nuance that `submit()` awaits `emit("RequestEvaluated")` before returning.)

---

## Claude's Discretion

- Module naming/placement (`approval/` vs `routing/`), branded IDs, Convex tables + tenant-prefixed/reverse-lookup indexes, event/error constant strings, `TenantContext.actorId` typing, composition-root wiring, and test fixtures — all left to planner/researcher per Phase 1-4 patterns.

## Deferred Ideas

- Multi-stage / multi-role chains (future policy-declared model) — D-45/D-46.
- Parallel stages, branching, escalation, retries, deadlines — D-46.
- Fallback approvers / CEO escalation — rejected (D-43).
- Notifications / webhooks on completion — future Decision Consumers.
- Approver inbox / Approve-Reject UI — Phase 6 (UI-03).
- Role-bucket claims — rejected for Phase 5 (D-49/D-52).
