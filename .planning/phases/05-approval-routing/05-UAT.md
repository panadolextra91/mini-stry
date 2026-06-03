---
status: complete
phase: 05-approval-routing
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md]
started: 2026-06-03T10:50:06Z
updated: 2026-06-03T10:59:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: From a clean state, `npx convex dev --once` bundles and pushes the schema with no "bundle node-api" blocker; `approvalChains` + `approvalTasks` tables and `requestEvaluations.requesterId` exist on the deployment; `npm test` is green and `tsc`/`eslint` are clean.
result: pass

### 2. Approval Chain Materialization (happy path)
expected: When the runtime emits a `request-approval` Decision, ApprovalRoutingService consumes it and persists exactly one ApprovalChain (status IN_PROGRESS) plus one ApprovalTask (stageNumber 1, state PENDING) whose approverId is the resolved manager.
result: pass

### 3. Manager-Chain Approver Resolution
expected: The resolver walks upward from `requester.managerId` (requester is self-excluded — never self-approves) and selects the FIRST ancestor whose roleId equals the Decision's targetRoleId. The role is validated against the Role registry first; the walk is bounded by MAX_HIERARCHY_DEPTH = 50.
result: pass

### 4. Routing Failure Isolation (D-54 / SC#1)
expected: An unresolvable chain (no ancestor holds the role), a missing target role, or a null requester produces an `ApprovalRoutingFailed` event and creates NO chain — while the persisted RequestEvaluation survives and request submission never breaks (a failing subscriber cannot bubble into submit()).
result: pass

### 5. Approve / Reject State Machine + Authorization
expected: Only the user matching task.approverId (compared to ctx.actorId) may act → otherwise UnauthorizedApproverError. Acting on an already-resolved task → TaskAlreadyResolvedError. APPROVE drives the task and (single-task) chain to APPROVED; REJECT drives them to REJECTED; terminal states reject further transitions.
result: pass

### 6. Idempotency
expected: Consuming the same evaluationRecordId twice (e.g. event replay) results in exactly ONE chain — the second consumption is a no-op via the findByRequestEvaluationId pre-check.
result: pass

### 7. Audit By-Reference (D-53)
expected: Approve, Reject, and routing-failure each emit an approval.* audit log carrying only references (eventType, ids, actorId, timestamp) — never the Decision or request content.
result: pass

### 8. Tenant Isolation (CON-01)
expected: All chain/task reads are filtered by ctx.tenantId (tenant-prefixed Convex indexes); a read with a different tenant's context returns null/empty — no cross-tenant leakage.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
