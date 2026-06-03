# Phase 4: Request Runtime - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers the **Request Runtime**: the application-layer orchestration that turns a submitted request payload into a persisted, traceable Decision. It wraps the pure Phase 2 runtime (`validateAndEvaluate`) with `TenantContext`, policy resolution, persistence, and audit.

**The flow:**

```
Request submission (requestType + EvaluationContext input)
  → resolve active PolicyVersion (tenantId + requestType)
  → validateAndEvaluate(validator, version.content, input)   [Phase 2 runtime, reused]
  → persist RequestEvaluation (input + decision + trace)
  → emit domain event → AuditLog by-reference
```

**Phase 4 IS:**

- A new application service (`PolicyRuntimeService`) that takes `TenantContext` as its first parameter (D-19) and orchestrates resolution → evaluation → persistence → audit.
- A new operational domain entity `RequestEvaluation` and its Convex table (D-38) — the queryable record of every concrete evaluation.
- Extending the `Policy` entity with a machine-readable `requestType` routing key (D-39) — a schema change to the `policies` table plus a `createPolicy` signature change.
- Persisting the step-by-step decision path (`trace[] = {ruleId, matched}`) and request input for deterministic replay (D-42).
- Audit-log records (by-reference) for evaluation success, evaluation failure, and resolution failure — extending the existing `EventDispatcher` → `AuditEventSubscriber` pattern.
- Requirements delivered: **DEC-01** (evaluate EvaluationContext against active policies → Decision), **AUD-02** (audit records tracking the exact decision path).

**Phase 4 IS NOT:**

- Any Decision Consumer — approval routing, notifications, escalation (Phase 5, DEC-03). The runtime persists the Decision and emits an event; consuming it is out of scope.
- Modifying the pure evaluator's trace contract. The evaluator's `TraceEntry = {ruleId, matched}` (D-30) is persisted **as-is**; richer detail is derived by replay, not materialized (D-42).
- UI for request submission / log visualization (Phase 6, UI-02/UI-04). Phase 4 exposes services + Convex handlers, not React.
- Idempotency / dedup of submissions (deferred — see Deferred Ideas).
- AND/OR/NOT operators, nested context, coercion (v2 / deferred per Phase 2).

</domain>

<decisions>
## Implementation Decisions

### Decision Record Persistence (D-38)

Evaluation results are stored in a **dedicated operational table** `RequestEvaluation` (a.k.a. DecisionRecord) — separate from the governance ledger.

- **`RequestEvaluation` stores:** `tenantId`, `requestType`, `requestInput`, `policyVersionId`, `evaluationResult`, `decision`, `trace`, `status`, `createdAt`.
- **Audit logs remain by-reference (D-37):** an `AuditLog` entry stores `eventType`, `evaluationRecordId`, `actorId`, `timestamp` — never the input/trace content.
- **Workload split:** operational queries hit `RequestEvaluation`; governance/audit queries hit `AuditLog`.
- **Pattern reuse:** mirrors Phase 3 — service emits a domain event, `AuditEventSubscriber` persists the by-reference audit record via `EventDispatcher`.

### Policy Resolution (D-39)

`Policy` owns a dedicated **machine-readable `requestType`** field used for runtime routing.

- **`Policy.name`** — human-readable, editable, display-only.
- **`Policy.requestType`** — stable routing key, used by runtime resolution, immutable after creation (recommended).
- **Resolution path:** `tenantId + requestType → Policy → activeVersionId → PolicyVersion`.
- **Uniqueness:** `tenantId + requestType` is unique (enforced in the application layer, consistent with the existing `[tenantId, name]` role uniqueness pattern).

### Evaluation Failure — Contract Violations (D-40)

An `EvaluationError` (MISSING_FIELD / TYPE_MISMATCH / UNSUPPORTED_OPERATOR, per D-28) **does not produce a Decision**.

- Persist a `RequestEvaluation` with `status = 'failed'`, `decision = null`, `errorCode` stored, `fieldPath` stored when applicable, and the **partial trace up to the failure point**.
- After persistence: emit an `EvaluationFailed` domain event → create an `AuditLog` by-reference.
- Finally: **rethrow / surface** the `EvaluationError` to the caller.
- Contract violations stay distinct from business decisions — a malformed request is never silently coerced into an auto-reject.

### Resolution Failure — Preconditions (D-41)

Policy-resolution failures (`PolicyNotFoundForRequestType`, `NoActivePolicyError`) are **precondition failures** that occur _before_ evaluation begins.

- **No `RequestEvaluation` record is created** (a record always corresponds to a concrete resolved `PolicyVersion`).
- **No nullable `policyVersionId`** is introduced — `RequestEvaluation.policyVersionId` stays non-null.
- The error is surfaced to the caller.
- A lightweight audit event is emitted for observability.

### Trace Persistence — Minimal Deterministic Replay (D-42)

Trace storage uses a **minimal deterministic replay** strategy.

- **Persist:** `requestInput`, `policyVersionId`, `decision`, `trace[] = { ruleId, matched }`.
- **Do NOT persist:** `field`, `operator`, `expectedValue`, `actualValue`.
- Governance and UI reconstruct exact decision paths by **replaying** `PolicyVersion.content` + `requestInput` + `trace`.
- `PolicyVersion` remains the canonical source of rule definitions; `trace` remains the canonical source of execution order and match results. No duplication (respects D-37); no change to the Phase 2 evaluator contract.

### Claude's Discretion

The planner/researcher may pick concrete approaches consistent with the decisions above:

- **Module placement** — a new `request/` (or `runtime-orchestration/`) module housing `PolicyRuntimeService` + the `RequestEvaluation` entity + ports/adapters, mirroring the Phase 1/2/3 module shape (`domain/application/ports/adapters/index.ts/README.md`). Must not introduce cross-module coupling (D-08); `Decision`/`EvaluationResult` come from `runtime/`'s barrel, `Policy`/`getActiveVersion` from `policy/`'s barrel.
- **Domain event names** — e.g. `RequestEvaluated` (success), `EvaluationFailed` (contract violation), and a resolution-failure observability event. Originating module owns the event constants; audit `eventType` strings follow the `<aggregate>.<action>` convention (e.g. `request.evaluated`, `request.evaluation_failed`, `request.resolution_failed`).
- **Re-validation at submit** — whether `PolicyRuntimeService` calls `validateAndEvaluate` (which re-runs schema validation, RUN-03 defense-in-depth) vs. trusting that published versions are already valid. Either is acceptable; default toward `validateAndEvaluate` to keep the evaluator structurally unreachable on invalid content.
- **`RequestEvaluation` branded ID + status enum** — follow the Phase 1 branded-ID pattern (`runtime`/`request` module owns its IDs); `status` is a small union (e.g. `'completed' | 'failed'`).
- **`createPolicy` signature evolution** — how `requestType` is threaded into policy creation and where uniqueness is enforced (likely in `PolicyService.createPolicy`).
- **Convex handler wiring** — thin DI assembly only (convex/ HARD RULE); no orchestration logic in `convex/`.
- **Test fixtures** — request-submission → expected RequestEvaluation tuples; co-located unit tests with in-memory repositories.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or implementing.**

### Vision & Architecture

- `.planning/PROJECT.md` — runtime formula `Policy + EvaluationContext → Decision`, Concept Hierarchy (Runtime #4, Decision #5, Decision Consumers #6, Audit Log #9), Hexagonal + Modular Monolith, domain-neutrality + no-`eval()` constraints.
- `.planning/PROJECT.md` §"Constraints" — **`TenantContext` MUST be the first parameter of every application service method** (Phase 4 `PolicyRuntimeService` is the first heavy user); no ambient resolution.
- `.planning/PROJECT.md` §"Key Decisions" — "Decision Consumers Are External to the Runtime" (Phase 4 emits/persists Decisions but does NOT consume them), "convex/ HARD RULE" (thin DI only).

### Requirements (Active for Phase 4)

- `.planning/REQUIREMENTS.md` §DEC (DEC-01) — evaluate an `EvaluationContext` against active policy JSON rules → structured Decision.
- `.planning/REQUIREMENTS.md` §AUD (AUD-02) — audit records tracking the exact decision path of evaluations.

### Phase Plan & Success Criteria

- `.planning/ROADMAP.md` §"Phase 4: Request Runtime" — goal, dependency (Phase 3), success criteria (2 items), plan breakdown (04-01 submission handlers + `PolicyRuntimeService`, 04-02 path tracer + AuditLog recording).

### Phase 2 Runtime (the pure core being wrapped — HARD constraints)

- `.planning/phases/02-policy-runtime-core/02-CONTEXT.md` — D-27 (flat `EvaluationContext`, caller flattens), D-28 (contract violation vs predicate failure; structured `EvaluationError` codes — Phase 4 decides handling, now D-40/D-41), D-29 (`Decision` discriminated union), D-30 (`EvaluationResult` with first-class `evaluationTrace = {ruleId, matched}` — Phase 4 persists it, AUD-02), D-31 (no `decision/` module; `Decision` owned by `runtime/`).
- `src/modules/runtime/index.ts` — public barrel: `validateAndEvaluate`, `evaluate`, `AjvSchemaValidator`, `SchemaValidatorPort`, `Decision`, `EvaluationResult`, `TraceEntry`, `EvaluationContext`, `EvaluationError`, `PolicySchemaInvalidError`.
- `src/modules/runtime/application/policy-runtime.ts` — `validateAndEvaluate(validator, content, ctx)` is the seam Phase 4 wraps; its own header comment names Phase 4 as the orchestration layer.

### Phase 3 Lifecycle (policy resolution source — HARD constraints)

- `.planning/phases/03-policy-lifecycle/03-CONTEXT.md` — D-32 (drafts as `PolicyVersion` w/ `status`), D-33 (forward-clone rollback; version numbers monotonic), D-35 (synchronous in-process domain events via `EventDispatcher` — Phase 4 extends this), D-37 (audit by-reference — IDs + metadata only, never content).
- `src/modules/policy/index.ts` — public barrel: `PolicyService`, `Policy`, `PolicyVersion`, `PolicyId`, `PolicyVersionId`, `PolicyEventMap`, `EventDispatcher`.
- `src/modules/policy/application/policy-service.ts` §`getActiveVersion(ctx, policyId)` — the resolution primitive (lines 223-232); Phase 4 resolves `requestType → policyId` then reuses this. `createPolicy` (lines 27-32) must be extended for `requestType` (D-39).

### Phase 1 Foundations (inherited contracts — HARD constraints)

- `.planning/phases/01-core-platform-foundations/01-CONTEXT.md` — D-08 (Module Boundary Rule: barrel-only imports; add an ESLint `import/no-restricted-paths` zone for the new module), D-13 (entities are plain TS interfaces), D-14/D-15 (branded string IDs owned by defining module), D-18 (constructor-injected ports), D-19 (`TenantContext` first parameter), D-20 (service-first testing with in-memory fakes).

### Persistence (schema to extend)

- `convex/schema.ts` — add a `requestEvaluations` table (D-38) and add `requestType` + index to the `policies` table (D-39). `auditLogs` stays by-reference (D-37). Follow tenant-prefixed composite index convention (D-09).
- `src/modules/audit/index.ts` + `src/modules/audit/application/audit-event-subscriber.ts` — the by-reference audit subscriber pattern to extend for `request.*` events.

### Engineering Standards (HARD constraints)

- `docs/engineering.md` §"Testing Requirements" — Decision Generation: high coverage (Constraint: "100% test coverage for Policy Engine ... and Decision Generation"). Vitest stack wired since Phase 1.
- `docs/engineering.md` §"Code Quality" — TS strict, no `any`, no `eval()`, pure deterministic logic.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`validateAndEvaluate(validator, content, ctx)`** (`src/modules/runtime/application/policy-runtime.ts`) — the exact seam Phase 4 wraps. Returns `EvaluationResult { decision, matchedRuleId, evaluationTrace }`. No change needed.
- **`PolicyService.getActiveVersion(ctx, policyId)`** — returns the active `PolicyVersion` (with `.content`). Phase 4 resolves `requestType → policyId` then calls this.
- **`EventDispatcher` + `AuditEventSubscriber`** (`src/modules/audit/application/audit-event-subscriber.ts`) — the synchronous, in-process by-reference audit pattern (D-35/D-37). Phase 4 adds `request.*` event handlers in the same shape.
- **Module skeleton** — `directory/`, `runtime/`, `policy/`, `audit/` all share `{domain, application, ports, adapters, index.ts, README.md}`. The new `request/` module mirrors this exactly.
- **Branded-ID + custom-error patterns** — `src/modules/*/domain/ids.ts` and `*/application/errors.ts` are the templates for `RequestEvaluationId`, `NoActivePolicyError`, `PolicyNotFoundForRequestType`.
- **Convex adapter pattern** — `src/modules/policy/adapters/convex/` (repository + mappers + `_branded.ts` bridge) and the in-memory fake in `adapters/memory/` are the templates for the `RequestEvaluation` repository.

### Established Patterns

- **D-08 ESLint zones** — `eslint.config.*` has `import/no-restricted-paths` zones for existing modules; Phase 4 MUST add a zone for the new module.
- **ES module `.js` import extensions** — Node ESM convention throughout (`from "./ids.js"`).
- **Tenant-prefixed Convex indexes** (D-09) — every tenant-owned table prefixes indexes with `tenantId`; the new `requestEvaluations` table follows.
- **Application-layer uniqueness** — roles enforce `[tenantId, name]` uniqueness in the service layer (not a DB constraint); `Policy` `[tenantId, requestType]` (D-39) follows the same approach.

### Integration Points

- **`policies` table + `Policy` entity get `requestType`** (D-39) — schema migration + `createPolicy` signature change + uniqueness enforcement. This touches Phase 3 code; planner must run impact analysis on `Policy`, `PolicyService.createPolicy`, and the policy Convex adapters/mappers.
- **`PolicyVersion.content` is `unknown`/`v.any()`** — `validateAndEvaluate` narrows it via the validator's `ValidationResult` (no cast at the call site). The runtime never trusts `content` blindly.
- **`auditLogs.payload` is `v.any()`** — stores the by-reference envelope (`evaluationRecordId`, `actorId`, etc.), never input/trace content (D-37).
- **Composition root** — `PolicyRuntimeService` needs the `SchemaValidatorPort` (`AjvSchemaValidator`), the policy resolution port(s), the `RequestEvaluation` repository, and the `EventDispatcher` injected via constructor (D-18). Convex handlers do this thin wiring (convex/ HARD RULE).

</code_context>

<specifics>
## Specific Ideas

- **`RequestEvaluation` is the operational source of truth; `AuditLog` is the governance ledger.** Two distinct stores with two distinct workloads (D-38) — do not conflate them. The audit entry only ever holds a reference (`evaluationRecordId`) plus actor/timestamp metadata.
- **Three outcome paths, three distinct behaviors:**
  1. **Success** → `RequestEvaluation { status: 'completed', decision, trace }` + `RequestEvaluated` event + audit by-ref.
  2. **Contract violation** (`EvaluationError`, D-40) → `RequestEvaluation { status: 'failed', decision: null, errorCode, fieldPath, partial trace }` + `EvaluationFailed` event + audit by-ref + **rethrow**.
  3. **Resolution failure** (D-41) → **no record**, surface error, lightweight audit event only.
- **Replay over materialization** (D-42). The "exact decision path" with operator/field/value detail is _derived on demand_ by re-running the immutable `PolicyVersion.content` against the snapshotted `requestInput`, guided by the `{ruleId, matched}` trace. The immutability of published versions (POL-03) is what makes this faithful.
- **`requestType` is a routing key, not a label** (D-39). It is immutable and machine-readable so routing stays stable even when an admin renames the policy's display `name`.

</specifics>

<deferred>
## Deferred Ideas

These surfaced as natural follow-ons. None are scope creep — they belong to other phases or v2.

- **Decision Consumers acting on persisted Decisions** — approval routing (Phase 5, DEC-03), notifications/webhooks (v2, DEC-06). Phase 4 emits/persists the Decision and stops there.
- **Request submission UI + request-log visualization** — Phase 6 (UI-02, UI-04). The governance viewer is the consumer of the replay strategy (D-42).
- **Idempotency / `requestId` dedup on submission** — not in Phase 4. If duplicate-submission protection is needed, add a `requestId` and a unique index later; `TenantContext` is already extensible to carry `requestId` (D-19) without signature churn.
- **Materialized rich trace** (operator/field/expected/actual per step) — explicitly rejected for v1 (D-42) in favor of replay. Revisit only if replay proves too expensive for governance workloads at scale.
- **AND/OR/NOT operators, nested context, type coercion** — v2 / rejected per Phase 2 (D-25/D-26/D-27). The request runtime inherits the v1 evaluator contract unchanged.

</deferred>

---

_Phase: 4-Request Runtime_
_Context gathered: 2026-06-03_
