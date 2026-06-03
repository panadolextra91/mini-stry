# Phase 3 Context: Policy Lifecycle

## Domain

Wrap the runtime in an administrative lifecycle — draft, publish (immutable), rollback — and persist policy publication audit logs. Lifecycle operations reuse the runtime's JSON Schema validator at their boundaries.

## Decisions

### Draft Data Model (D-32)

Drafts are represented as `PolicyVersion` entities with `status='draft'`.
The `Policy` entity owns identity and `activeVersionId` only.
The `PolicyVersion` owns: `content`, `versionNumber`, `status`, `createdBy`, `createdAt`, `publishedAt`.
A policy may have zero or one active draft version, and exactly one active published version. Lifecycle transitions occur on `PolicyVersion`, not `Policy`.

### Rollback Mechanism (D-33)

Rollback is implemented as forward-only version cloning. Rolling back from v3 to v1 creates a new draft version (v4) whose content is copied from v1. Publishing v4 makes it the active version. Version numbers are strictly monotonic and never decrease.
Includes optional metadata `rollbackFromVersionId`. Policy history represents what happened, not merely what is active.

### Validation Strictness (D-34)

Draft versions may contain invalid `PolicyContent`. Draft saves are always allowed. Validation runs on every draft save and updates `validationStatus` ('valid' | 'invalid') and `validationErrors`.
Publishing requires `validationStatus === 'valid'`. Validation is a publish gate, not a draft storage gate.

### Audit Log Invocation (D-35)

Audit logging is triggered through synchronous in-process Domain Events. No external messaging infrastructure (RabbitMQ, Kafka) is used.
`PolicyService` emits domain events (`PolicyPublished`, `PolicyRolledBack`, `DraftCreated`, `DraftUpdated`). Audit subscribers listen to these events and persist `AuditLog` records using a lightweight in-memory event dispatcher.

### Draft Concurrency (D-36)

Draft editing uses optimistic concurrency control. `PolicyVersion` contains a `revision: number`. `SaveDraft` requires `expectedRevision` alongside `content`. The save succeeds only if `expectedRevision === currentRevision`, and increments `revision`. Mismatches throw a `ConflictError`. No draft locking or collaborative editing workflow.

### Audit Log Snapshot Strategy (D-37)

Audit logs use a by-reference strategy. Records store `eventType`, `policyId`, `policyVersionId`, `versionNumber`, `actorId`, `timestamp`, and `rollbackFromVersionId` (if applicable). Audit records do not duplicate `PolicyContent`. `PolicyVersion` remains the canonical immutable source of policy content, and is retrieved via a join.

## Canonical Refs

- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/PROJECT.md`
