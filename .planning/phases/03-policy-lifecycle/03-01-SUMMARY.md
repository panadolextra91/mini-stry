---
phase: 3
plan: 1
subsystem: policy/lifecycle
tags: [domain-events, lifecycle, validation, concurrency]
dependency_graph:
  requires: [runtime/schema-validator, directory/tenant-context, shared/event-dispatcher]
  provides: [policy/policy-service, policy/events, policy/lifecycle-errors, policy/repository-ports]
  affects: [policy/domain/policy-version, policy/index, tests/_helpers/in-memory-fakes]
tech_stack:
  added: []
  patterns: [EventDispatcher, optimistic-concurrency, validation-on-save, one-draft-per-policy]
key_files:
  created:
    - src/modules/policy/domain/policy-version-status.ts
    - src/modules/policy/domain/policy-events.ts
    - src/modules/policy/application/errors.ts
    - src/modules/policy/application/policy-service.ts
    - src/modules/policy/ports/policy-repository.port.ts
    - src/modules/policy/ports/policy-version-repository.port.ts
    - src/modules/policy/adapters/memory/in-memory-policy-repository.ts
    - src/modules/policy/adapters/memory/in-memory-policy-version-repository.ts
    - src/shared/event-dispatcher.ts
    - tests/modules/policy/event-dispatcher.test.ts
    - tests/modules/policy/policy-service.test.ts
  modified:
    - src/modules/policy/domain/policy-version.ts
    - src/modules/policy/index.ts
    - tests/_helpers/in-memory-fakes.ts
decisions:
  - "D-32: One draft + one active published per policy. Enforce via DraftAlreadyExistsError."
  - "D-34: Validation on every save, not a draft storage gate. Publish gate requires validationStatus === 'valid'."
  - "D-35: Synchronous in-process EventDispatcher<PolicyEventMap> — 3 event types (DraftCreated, DraftUpdated, PolicyPublished). No PolicyRolledBack event."
  - "D-36: Optimistic concurrency via revision field. ConflictError on mismatch."
  - "POL-03: Published versions are immutable. ImmutableVersionError on save/re-publish."
metrics:
  duration: 8m
  completed: 2026-06-02
---

# Phase 3 Plan 01: Lifecycle domain contracts, PolicyService, and EventDispatcher Summary

PolicyService core lifecycle — typed domain contracts, validation-on-save, optimistic concurrency, and synchronous event dispatch for the draft→published state machine.

## What Was Built

### Domain Layer

- **PolicyVersionStatus** (`draft | published`) and **ValidationStatus** (`valid | invalid | unchecked`) type aliases
- **PolicyEventMap** with 3 typed events: `DraftCreated`, `DraftUpdated`, `PolicyPublished`. No `PolicyRolledBack` — rollback is inferred from `DraftCreated.rollbackFromVersionId`
- **PolicyVersion** extended with: `status`, `validationStatus`, `validationErrors`, `revision`, `rollbackFromVersionId`, `createdBy`, `createdAt`

### Application Layer

- **PolicyService** with 4 operations: `createPolicy`, `createDraft`, `saveDraft`, `publishDraft`
  - D-32: One draft per policy enforced via `DraftAlreadyExistsError`
  - D-34: Validation runs on every save via `SchemaValidatorPort`; publish gate requires `valid`
  - D-36: Optimistic concurrency via `revision` field with `ConflictError`
  - POL-03: Published versions throw `ImmutableVersionError` on save/re-publish
- **Error classes** (6): `PolicyNotFoundError`, `DraftNotFoundError`, `VersionNotFoundError`, `ImmutableVersionError`, `InvalidPublishError`, `ConflictError`, `DraftAlreadyExistsError`

### Ports & Adapters

- **PolicyRepositoryPort** (3 methods): `create`, `findById`, `updateActiveVersion`
- **PolicyVersionRepositoryPort** (5 methods): `create`, `findById`, `findDraftByPolicy`, `update`, `getNextVersionNumber`
- **InMemoryPolicyRepository** and **InMemoryPolicyVersionRepository** — in-memory fakes with tenant isolation

### Infrastructure

- **EventDispatcher\<EventMap\>** — generic typed dispatcher with sequential handler execution, no external messaging

### Tests

- **EventDispatcher**: 6 tests (handler invocation, ordering, async sequential, type isolation)
- **PolicyService**: 18 tests (lifecycle, validation, concurrency, errors, tenant isolation, full flow)
- **Total**: 24 new tests, all passing. Full suite: 142 tests, 0 failures.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All 11 created files verified on disk. Commits `857bdc9` and `93fa535` verified in git log.
