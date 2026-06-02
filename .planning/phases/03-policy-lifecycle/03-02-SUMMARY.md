---
phase: 3
plan: 2
subsystem: policy/lifecycle + audit
tags: [rollback, audit, convex, adapters]
dependency_graph:
  requires: [03-01, runtime/schema-validator, directory/tenant-context, shared/event-dispatcher]
  provides: [policy/rollback, policy/getActiveVersion, audit/subscriber, audit/ports, convex/adapters]
  affects: [policy/policy-service, convex/schema, policy/index, audit/index, tests/_helpers/in-memory-fakes]
tech_stack:
  added: []
  patterns: [forward-only-rollback, by-reference-audit, event-subscriber, convex-adapter]
key_files:
  created:
    - src/modules/audit/ports/audit-log-repository.port.ts
    - src/modules/audit/adapters/memory/in-memory-audit-log-repository.ts
    - src/modules/audit/application/audit-event-subscriber.ts
    - src/modules/audit/adapters/convex/mappers.ts
    - src/modules/audit/adapters/convex/convex-audit-log-repository.ts
    - src/modules/policy/adapters/convex/mappers.ts
    - src/modules/policy/adapters/convex/convex-policy-repository.ts
    - src/modules/policy/adapters/convex/convex-policy-version-repository.ts
    - tests/modules/audit/audit-subscriber.test.ts
  modified:
    - src/modules/policy/application/policy-service.ts
    - src/modules/audit/index.ts
    - src/modules/policy/index.ts
    - convex/schema.ts
    - tests/_helpers/in-memory-fakes.ts
    - tests/modules/policy/policy-service.test.ts
    - tests/modules/policy/event-dispatcher.test.ts
decisions:
  - "D-33: Rollback as forward-only clone (v1→v3 with v1's content). No separate PolicyRolledBack event."
  - "D-37: Audit payloads by-reference only: IDs, tenantId, actorId — never content."
  - "POL-04: Active version tracking via Policy.activeVersionId, updated on publish."
  - "AUD-01: All 3 event types (DraftCreated, DraftUpdated, PolicyPublished) produce audit records via subscriber."
metrics:
  duration: 12m
  completed: 2026-06-02
---

# Phase 3 Plan 02: Rollback, Audit, Convex Adapters Summary

Rollback-as-forward-clone, audit event subscribers, and Convex persistence adapters. Completes POL-04 and AUD-01.

## What Was Built

### Rollback (POL-04)
- **PolicyService.rollback()**: Forward-only clone creating new draft (v_N+1) from target (v_M) with `rollbackFromVersionId` metadata
- Validation not re-run on rollback — `validationStatus` and `validationErrors` cloned directly from source
- Emits `DraftCreated` with `rollbackFromVersionId != null` (no separate PolicyRolledBack event)
- DraftAlreadyExistsError if active draft exists; VersionNotFoundError if target missing

### Active Version (POL-04)
- **PolicyService.getActiveVersion()**: Returns current active version via `Policy.activeVersionId`, or null

### Audit Event Subscriber (AUD-01)
- **AuditEventSubscriber**: Constructor-wired to all 3 PolicyEventMap events via EventDispatcher.on()
- `DraftCreated` → `policy.draft_created` (includes `rollbackFromVersionId`)
- `DraftUpdated` → `policy.draft_updated`
- `PolicyPublished` → `policy.published`
- By-reference payloads (D-37): tenantId, policyId, policyVersionId, versionNumber, actorId — never content

### Audit Infrastructure
- **AuditLogRepositoryPort**: `create` + `findByTenant` (append-only, no update/delete)
- **InMemoryAuditLogRepository**: Test fake with tenant isolation

### Convex Schema
- policyVersions: 6 new fields (status, validationStatus, validationErrors, revision, rollbackFromVersionId, createdBy)
- New index: `by_tenant_policy_status` on `[tenantId, policyId, status]`

### Convex Adapters
- **ConvexPolicyRepository**: 3 methods (create, findById, updateActiveVersion)
- **ConvexPolicyVersionRepository**: 5 methods with `findDraftByPolicy` using status index
- **ConvexAuditLogRepository**: 2 methods with `by_tenant_created` index
- All mappers: `toPolicyDomain`, `toPolicyVersionDomain` (with ValidationError reconstruction), `toAuditLogDomain`

### Tests
- **PolicyService**: 27 tests (7 rollback + 2 getActiveVersion added to existing 18)
- **AuditEventSubscriber**: 7 tests (event types, rollback inference, lifecycle, D-37, tenant scoping)
- **Total**: 158 tests across 21 files, all passing
- **TypeScript**: `tsc --noEmit` passes clean

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All acceptance criteria verified. All created files on disk. Commits verified in git log.
