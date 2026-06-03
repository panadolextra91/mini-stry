---
phase: 05-approval-routing
plan: 01
subsystem: api
tags: [vitest, typescript, event-dispatcher, domain]

# Dependency graph
requires:
  - phase: 04-request-runtime
    provides: request evaluation, submission orchestration, requestType uniqueness, convex request table
provides:
  - approval module domain entities (ApprovalChain, ApprovalTask)
  - state-machine logic (transitionTask, deriveChainStatus)
  - application errors (RoutingError, HierarchyTraversalError, TaskAlreadyResolvedError, UnauthorizedApproverError)
  - ports (ApprovalChainRepositoryPort, ApprovalTaskRepositoryPort)
  - InMemory repositories (InMemoryApprovalChainRepository, InMemoryApprovalTaskRepository)
  - Hardened EventDispatcher with try/catch isolation and onError hooks (D-54)
  - TenantContext and RequestEvaluation carrying actorId/requesterId (D-47 / D-48)
affects:
  - 05-02-PLAN.md

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Consumer-Operational isolation
    - Subscriber isolation try/catch
    - Domain-purity error split

key-files:
  created:
    - src/modules/approval/domain/state-machine.ts
    - src/modules/approval/ports/approval-chain-repository.port.ts
    - src/modules/approval/ports/approval-task-repository.port.ts
    - tests/modules/approval/state-machine.test.ts
    - tests/modules/approval/repository.test.ts
  modified:
    - src/shared/event-dispatcher.ts
    - src/modules/directory/application/tenant-context.ts
    - src/modules/request/domain/request-evaluation.ts
    - src/modules/request/ports/request-evaluation-repository.port.ts
    - src/modules/request/adapters/memory/in-memory-request-evaluation-repository.ts
    - src/modules/request/application/policy-runtime-service.ts
    - eslint.config.js

key-decisions:
  - "Two-error split for state machine: InvalidTaskTransitionError defined co-located in state-machine.ts (domain) to maintain domain-purity without importing application errors. TaskAlreadyResolvedError is thrown at application service level."

patterns-established:
  - "Subscriber try/catch isolation: emit() loop wraps handler invocation in try/catch to protect publisher from throwing subscribers (D-54)."

requirements-completed: [DEC-03]

# Metrics
duration: 35min
completed: 2026-06-03
---

# Phase 5: Approval Routing - Plan 01 Summary

**Approval module domain foundation, pure state machine, application errors, ports, InMemory repositories, hardened EventDispatcher, and requesterId/actorId threading implemented and verified.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-06-03T16:15:00Z
- **Completed:** 2026-06-03T16:50:00Z
- **Tasks:** 3
- **Files modified:** 8
- **Files created:** 10

## Accomplishments

- Hardened `EventDispatcher` to isolate subscriber errors using try/catch wrapper per invocation and an `onError` logging hook, preventing throwing subscribers from crashing the dispatch pipeline (D-54).
- Added optional `actorId` to `TenantContext` (D-48) and `requesterId` to `RequestEvaluation` (D-47), threading it through the policy runtime service submission process.
- Designed and implemented the `approval/` domain types (entities, branded IDs, string unions, event map, pure state machine) under a strict ESLint module isolation zone (D-08).
- Implemented pure transition logic: `transitionTask` and `deriveChainStatus` with 100% test coverage.
- Defined repository ports and InMemory repositories for approval chains and tasks with tenant-scoping (CON-01).

## Task Commits

Each task was committed atomically:

1. **Task 1: Additive ripples (dispatcher, context, requesterId)** - `ff053e3` (feat)
2. **Task 2: Approval domain skeleton & state machine** - `ff053e3` (feat)
3. **Task 3: Ports, memory fakes, barrel, README, ESLint zone** - `ff053e3` (feat)

## Files Created/Modified

- `src/shared/event-dispatcher.ts` - Hardened event dispatcher with try/catch isolation and onError hooks.
- `src/modules/directory/application/tenant-context.ts` - Added optional `actorId`.
- `src/modules/request/domain/request-evaluation.ts` - Added `requesterId`.
- `src/modules/approval/domain/state-machine.ts` - Pure state machine transition functions.
- `tests/modules/approval/state-machine.test.ts` - Test suite for task transitions and chain status derivation.
- `tests/modules/approval/repository.test.ts` - Tests for InMemory repos, custom errors, and IDs.
- `eslint.config.js` - Registered `approval` restricted-paths module zone.

## Decisions Made

- **Two-error split**: Threw domain-local `InvalidTaskTransitionError` inside `state-machine.ts` to keep the domain layer pure from application-layer errors (D-51/D-52). `TaskAlreadyResolvedError` is deferred to the application service pre-check.

## Deviations from Plan

- **exactOptionalPropertyTypes**: The compiler failed on returning optional properties assigned to `undefined` in the `tenantContext` factory. Fixed by returning separate object literal forms depending on whether `actorId` is `undefined`.
- **Convex Mapper Compilation**: The Convex request mapper needed mapping for `requesterId` to satisfy the domain interface constraint in 05-01 compile check. Handled by casting the Convex document and mapping requesterId dynamically.

## Next Phase Readiness

- 05-01 is complete. Next step is 05-02: routing service, Convex schema, adapters, subscribers, and live integration.
