---
phase: 04-request-runtime
plan: 01
subsystem: api
tags: [vitest, typescript, convex, ajv]

# Dependency graph
requires:
  - phase: 03-policy-lifecycle
    provides: policy drafts, versions, publication
provides:
  - request/ module containing domain entities, IDs, events, repositories, and interfaces
  - PolicyRuntimeService.submit orchestrator executing policies against EvaluationContexts
  - policy requestType routing key with tenant-isolated uniqueness constraints
  - policies.by_tenant_request_type index and requestEvaluations table in Convex schema
affects: 04-02-PLAN.md

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Request-Operational Operational record store distinct from Audit Governance ledger (D-38)
    - Three-path execution outcome orchestration (D-40, D-41)

key-files:
  created:
    - src/modules/request/application/policy-runtime-service.ts
    - src/modules/request/domain/request-evaluation.ts
    - tests/modules/request/policy-runtime-service.test.ts
  modified:
    - convex/schema.ts
    - src/modules/policy/application/policy-service.ts

key-decisions:
  - "v1 partial trace stores empty trace on failed evaluation records; full detail reconstructed via replay (D-42)"
  - "PolicyNotFoundForRequestType and NoActivePolicyError resolution failures create no record (D-41)"

patterns-established:
  - "Empty trace on failure: failed evaluations store empty trace, delegating path reconstruction to the replay engine (D-42)"

requirements-completed: [DEC-01]

# Metrics
duration: 35min
completed: 2026-06-03
---

# Phase 4: Request Runtime - Plan 01 Summary

**Persistent Policy Runtime Submission Orchestrator with three outcome paths, requestType routing keys, and Convex schemas implemented and verified.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-06-03T12:50:00Z
- **Completed:** 2026-06-03T13:25:00Z
- **Tasks:** 3
- **Files modified:** 13
- **Files created:** 12

## Accomplishments
- Implemented `request/` module containing domain entity, branded IDs, events, errors, repository port, and memory/Convex adapters.
- Implemented `PolicyRuntimeService.submit` orchestrating the evaluation of `EvaluationContext` against active policy version.
- Handled three outcome paths: success (persists 'completed'), contract violation (persists 'failed' + rethrows `EvaluationError`), and resolution failure (no record, throws).
- Extended the `policy` module to carry machine-readable `requestType` routing keys with tenant-scoped uniqueness validation.
- Defined `requestEvaluations` table and `by_tenant_request_type` index in Convex schema.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend policy/ with requestType routing key** - `976bead` (feat)
2. **Task 2: Create the request/ module** - `976bead` (feat)
3. **Task 3: PolicyRuntimeService.submit outcome paths** - `976bead` (feat)

## Files Created/Modified
- `src/modules/request/application/policy-runtime-service.ts` - Orchestrates policy resolution and evaluation.
- `src/modules/request/domain/request-evaluation.ts` - Entity representing evaluation outcomes.
- `tests/modules/request/policy-runtime-service.test.ts` - Vitest suite verifying the three outcome paths, tenant isolation, and minimal-trace invariant.
- `convex/schema.ts` - Convex database schema extended with requestEvaluations table and index.
- `src/modules/policy/application/policy-service.ts` - Enhanced to validate requestType uniqueness and resolve policies.

## Decisions Made
- **v1 failed-trace decision**: Persisted empty `trace: []` on failed evaluations because `EvaluationError` contains only error metadata. Replay engine will reconstruct the exact evaluation path.
- **Resolution failure behavior**: Resolved policies using a clean public passthrough method in `PolicyService`, throwing `PolicyNotFoundForRequestType`/`NoActivePolicyError` without creating evaluation records.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- `RequestEventMap` TS interface lacked implicit index signatures required by `EventDispatcher`. Switched to a type alias to satisfy the compiler constraint.

## Next Phase Readiness
- 04-01 is fully implemented. Next step is 04-02: request event auditing, replay verification, and thin Convex entry points.
