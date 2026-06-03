# Phase 4: Request Runtime - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 4-request-runtime
**Areas discussed:** Decision record persistence, Policy resolution, Evaluation failure handling, Trace persistence shape

---

## Decision Record Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated table + audit by-ref | New `RequestEvaluation`/`requests` table (operational, queryable) + by-reference audit event. Mirrors Phase 3 event pattern, preserves D-37. | ✓ |
| auditLogs-only | Stuff the whole decision path into `auditLogs.payload`. Simpler but violates D-37, conflates operational + governance. | |
| decisionRecords only (no audit) | Full trace table but no audit log. Fails AUD-02 (audit log of decision path is mandatory). | |

**User's choice:** Dedicated operational table (free-text refinement → **D-38**).
**Notes:** Named the entity `RequestEvaluation` (a.k.a. DecisionRecord). Fields: `tenantId, requestType, requestInput, policyVersionId, evaluationResult, decision, trace, createdAt`. Audit entries stay by-reference: `eventType, evaluationRecordId, actorId, timestamp`. Operational query workloads → `RequestEvaluation`; governance/audit → `AuditLog`.

---

## Policy Resolution

| Option | Description | Selected |
|--------|-------------|----------|
| requestType == Policy.name | Resolve via existing `by_tenant_name` index. No schema change. | |
| Dedicated `requestType` field | Add machine-readable routing key separate from display name + index. Requires schema migration. | ✓ |
| Caller passes policyId directly | No type resolution; caller carries the burden. | |

**User's choice:** Dedicated `requestType` field (free-text refinement → **D-39**).
**Notes:** `Policy.name` = human-readable, editable, display-only. `Policy.requestType` = stable routing key, immutable after creation (recommended). Resolution: `tenantId + requestType → Policy → activeVersionId → PolicyVersion`. Unique constraint on `tenantId + requestType`.

---

## Evaluation Failure Handling

### Contract violations (EvaluationError)

| Option | Description | Selected |
|--------|-------------|----------|
| Record failure + surface | Persist a `RequestEvaluation` error record, then rethrow. | ✓ |
| Surface only, no record | Throw immediately, no record. Loses contract-violation trail. | |
| Treat as auto-reject | Convert to an auto-reject Decision. Rejected — conflates malformed request with policy decision (D-28). | |

**User's choice:** Record failure + surface (free-text refinement → **D-40**).
**Notes:** `EvaluationError` does NOT produce a Decision. Persist `RequestEvaluation` with `status='failed'`, `decision=null`, `errorCode`, `fieldPath` (when applicable), partial trace up to failure point. Emit `EvaluationFailed` event → AuditLog by-reference → rethrow/surface to caller. Contract violations stay distinct from business decisions.

### Resolution failures (precondition)

| Option | Description | Selected |
|--------|-------------|----------|
| Precondition error, no record | Throw distinct error before creating any record; non-null `policyVersionId` preserved. Lightweight audit event. | ✓ |
| Failed record, policyVersionId=null | Uniform with D-40 but requires nullable `policyVersionId`. | |

**User's choice:** Precondition error, no record (free-text refinement → **D-41**).
**Notes:** `PolicyNotFoundForRequestType` / `NoActivePolicyError` occur before evaluation begins. No `RequestEvaluation` created; no nullable `policyVersionId` introduced. Error surfaced to caller + lightweight audit event for observability. A `RequestEvaluation` exists only when a concrete `PolicyVersion` was successfully resolved.

---

## Trace Persistence Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal + derivable (replay) | Store `{ruleId, matched}` + `requestInput` + `policyVersionId`; derive rich detail by replay. No runtime change, respects D-37. | ✓ |
| Enrich trace materialized | Extend evaluator `TraceEntry` with field/op/expected/actual per step. Changes Phase 2 contract, duplicates data. | |
| Minimal, no replay | `{ruleId, matched}` only, no input snapshot. Cannot reconstruct exact path. Fails AUD-02 intent. | |

**User's choice:** Minimal deterministic replay (free-text refinement → **D-42**).
**Notes:** Persist `requestInput`, `policyVersionId`, `decision`, `trace[] = {ruleId, matched}`. Do NOT persist `field`, `operator`, `expectedValue`, `actualValue`. Governance/UI reconstruct exact decision paths by replaying `PolicyVersion.content + requestInput + trace`. `PolicyVersion` = canonical rule definitions; `trace` = canonical execution order + match results.

---

## Claude's Discretion

- Module placement for the new `request/` module (`PolicyRuntimeService` + `RequestEvaluation`), barrel-only imports (D-08).
- Domain event names (`RequestEvaluated`, `EvaluationFailed`, resolution-failure observability event) + audit `eventType` strings (`request.*`).
- Whether to re-run `validateAndEvaluate` (RUN-03 defense-in-depth) on active published content at submit time.
- `RequestEvaluation` branded ID + `status` union; `createPolicy` signature evolution for `requestType`; Convex thin DI wiring; test fixture layout.

## Deferred Ideas

- Decision Consumers acting on persisted Decisions — Phase 5 (DEC-03), v2 (DEC-06).
- Request submission UI + request-log visualization — Phase 6 (UI-02, UI-04).
- Idempotency / `requestId` dedup on submission — later; `TenantContext` extensible without signature churn.
- Materialized rich trace — rejected for v1 (D-42); revisit only at scale.
- AND/OR/NOT operators, nested context, type coercion — v2 / rejected per Phase 2.
