# Phase 3: Policy Lifecycle - Research

**Researched:** 2026-06-01
**Domain:** Policy versioning, lifecycle state machines, domain events, audit logging
**Confidence:** HIGH

## Summary

Phase 3 wraps the Phase 2 runtime in an administrative lifecycle: draft → publish (immutable) → rollback. The core technical challenge is implementing a state machine over `PolicyVersion` entities that respects immutability (published versions are frozen), enforces validation at publish-time (reusing the runtime's `SchemaValidatorPort`), and emits domain events consumed by audit log subscribers.

The codebase already has the foundational building blocks: `Policy` and `PolicyVersion` domain skeletons in `src/modules/policy/`, the `AuditLog` entity in `src/modules/audit/`, branded IDs (`PolicyId`, `PolicyVersionId`, `AuditLogId`), the `SchemaValidatorPort` + `AjvSchemaValidator` in `runtime/`, and the Convex schema with `policies`, `policyVersions`, and `auditLogs` tables. Phase 3 extends these skeletons into full lifecycle entities, adds application services, persistence adapters, and a lightweight domain event system.

**Primary recommendation:** Implement the lifecycle as two plans — (1) draft creation, validation, immutable publishing, and domain event infrastructure; (2) active-version selection, rollback-as-forward-clone, and Convex persistence adapters with audit event subscribers.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-32 (Draft Data Model):** Drafts are `PolicyVersion` entities with `status='draft'`. `Policy` owns identity + `activeVersionId` only. `PolicyVersion` owns: `content`, `versionNumber`, `status`, `createdBy`, `createdAt`, `publishedAt`. One draft + one active published per policy. Transitions on `PolicyVersion`, not `Policy`.
- **D-33 (Rollback Mechanism):** Forward-only version cloning. Rollback from v3→v1 creates v4 (copy of v1's content). Publish v4 to make it active. Version numbers are strictly monotonic. Includes `rollbackFromVersionId` metadata.
- **D-34 (Validation Strictness):** Drafts may contain invalid content. Validation runs on every save, updating `validationStatus` ('valid' | 'invalid') and `validationErrors`. Publishing requires `validationStatus === 'valid'`. Validation is a publish gate, not a draft storage gate.
- **D-35 (Audit Log Invocation):** Synchronous in-process Domain Events. No external messaging. `PolicyService` emits domain events (`DraftCreated`, `DraftUpdated`, `PolicyPublished`). There is no separate `PolicyRolledBack` event — rollback is modeled as `DraftCreated` (with `rollbackFromVersionId != null`) followed by `PolicyPublished`. Audit subscribers infer rollback from `rollbackFromVersionId`. Audit subscribers persist `AuditLog` records via lightweight in-memory event dispatcher.
- **D-36 (Draft Concurrency):** Optimistic concurrency control. `PolicyVersion` contains `revision: number`. `SaveDraft` requires `expectedRevision`. Save succeeds only if `expectedRevision === currentRevision`, increments revision. Mismatches throw `ConflictError`.
- **D-37 (Audit Log Snapshot Strategy):** By-reference. Records store `eventType`, `tenantId`, `policyId`, `policyVersionId`, `versionNumber`, `actorId`, `timestamp`, `rollbackFromVersionId`. No content duplication. `PolicyVersion` is the canonical immutable source. Audit payloads may include `tenantId` metadata.

### Agent's Discretion

- Event dispatcher implementation details (synchronous vs microtask)
- Error class hierarchy for lifecycle errors
- Repository port method signatures
- Test fixture patterns
- Convex adapter implementation details

### Deferred Ideas (OUT OF SCOPE)

None — CONTEXT.md covers phase scope.
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID     | Description                                                                   | Research Support                                                                           |
| ------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| POL-01 | Support creating policies containing structured JSON rule blocks              | Draft creation via `PolicyService.createDraft()` using existing `PolicyContent` schema     |
| POL-02 | Support publishing policies. (Draft creation allocates the version number)    | Immutable publish transition: `status='draft'` → `status='published'`, `publishedAt` set   |
| POL-03 | Guarantee absolute immutability of policy versions once published             | `PolicyVersion` with `status='published'` rejects all mutations; enforced at service layer |
| POL-04 | Track the single active policy version, allowing seamless rollback            | `Policy.activeVersionId` tracks current; rollback creates forward clone (D-33)             |
| AUD-01 | Create immutable audit log records when policies are published or rolled back | Domain event subscribers persist `AuditLog` records with by-reference strategy (D-37)      |

</phase_requirements>

## Architectural Responsibility Map

| Capability                      | Primary Tier                  | Secondary Tier    | Rationale                                                                        |
| ------------------------------- | ----------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| Draft CRUD                      | Application (PolicyService)   | Database (Convex) | Business rules (validation, concurrency) live in service; persistence in adapter |
| Publish Gate (immutability)     | Application (PolicyService)   | —                 | Pure business rule: reject publish if invalid, freeze after publish              |
| Schema Validation at boundaries | Application (PolicyService)   | Runtime module    | PolicyService calls `SchemaValidatorPort.validate()` from runtime module via DI  |
| Active-version tracking         | Application (PolicyService)   | Database (Convex) | Service updates `Policy.activeVersionId`; adapter persists atomically            |
| Rollback-as-forward-clone       | Application (PolicyService)   | —                 | Pure business logic: clone content from source version, create new draft         |
| Domain Events                   | Application (EventDispatcher) | —                 | In-process, synchronous, no external infra (D-35)                                |
| Audit Logging                   | Application (AuditSubscriber) | Database (Convex) | Subscriber listens to domain events, writes via AuditLogRepositoryPort           |
| Optimistic Concurrency          | Application (PolicyService)   | Database (Convex) | Service checks `revision`; adapter uses conditional update                       |

## Standard Stack

### Core

| Library    | Version         | Purpose                | Why Standard                                                              |
| ---------- | --------------- | ---------------------- | ------------------------------------------------------------------------- |
| TypeScript | ^5.x (existing) | Language               | Already in project                                                        |
| Vitest     | ^3.x (existing) | Test framework         | Already configured with 100% runtime coverage thresholds                  |
| Ajv        | ^8.x (existing) | JSON Schema validation | Already in `runtime/adapters/ajv/`; reused at lifecycle boundaries (D-34) |

### Supporting

No new external dependencies required. Phase 3 is entirely internal domain logic, application services, and Convex adapters — all using existing project infrastructure.

**Installation:** No new packages needed.

## Architecture Patterns

### System Architecture Diagram

```
Admin/API
    │
    ▼
PolicyService (application layer)
    │
    ├──► SchemaValidatorPort.validate() ─── reuses runtime's AjvSchemaValidator
    │         (on every draft save for validationStatus,
    │          and as publish gate)
    │
    ├──► PolicyRepositoryPort ─── CRUD for Policy aggregate
    │         │
    │         └──► ConvexPolicyRepository (adapter)
    │
    ├──► PolicyVersionRepositoryPort ─── CRUD for PolicyVersion
    │         │
    │         └──► ConvexPolicyVersionRepository (adapter)
    │
    ├──► EventDispatcher.emit(event) ─── synchronous in-process (D-35)
    │         │
    │         └──► AuditEventSubscriber.handle(event)
    │                   │
    │                   └──► AuditLogRepositoryPort.create()
    │                             │
    │                             └──► ConvexAuditLogRepository (adapter)
    │
    └──► TenantContext (first param to every method)
```

### Recommended Project Structure

```
src/modules/policy/
├── domain/
│   ├── ids.ts                      # (existing) PolicyId, PolicyVersionId
│   ├── policy.ts                   # (EXTEND) Add requestType field
│   ├── policy-version.ts           # (EXTEND) Add status, validationStatus, validationErrors, revision, rollbackFromVersionId, createdBy
│   ├── policy-events.ts            # (NEW) Domain event types: DraftCreated, DraftUpdated, PolicyPublished (no PolicyRolledBack — rollback inferred from DraftCreated.rollbackFromVersionId)
│   └── policy-version-status.ts    # (NEW) Status enum: 'draft' | 'published'
├── application/
│   ├── policy-service.ts           # (NEW) Lifecycle orchestrator
│   └── errors.ts                   # (NEW) ImmutableVersionError, DraftNotFoundError, InvalidPublishError, ConflictError, etc.
├── ports/
│   ├── policy-repository.port.ts   # (NEW) Policy aggregate port
│   └── policy-version-repository.port.ts  # (NEW) PolicyVersion persistence port
├── adapters/
│   ├── memory/
│   │   ├── in-memory-policy-repository.ts         # (NEW) Test fake
│   │   └── in-memory-policy-version-repository.ts # (NEW) Test fake
│   └── convex/
│       ├── convex-policy-repository.ts         # (NEW) Production adapter
│       ├── convex-policy-version-repository.ts # (NEW) Production adapter
│       └── mappers.ts                          # (NEW) Convex doc ↔ domain mappers
└── index.ts                        # (EXTEND) Export new types and service

src/modules/audit/
├── domain/
│   ├── ids.ts           # (existing)
│   └── audit-log.ts     # (existing, sufficient for D-37)
├── application/
│   └── audit-event-subscriber.ts  # (NEW) Subscribes to policy domain events
├── ports/
│   └── audit-log-repository.port.ts  # (NEW) Persistence port
├── adapters/
│   ├── memory/
│   │   └── in-memory-audit-log-repository.ts  # (NEW) Test fake
│   └── convex/
│       ├── convex-audit-log-repository.ts  # (NEW) Production adapter
│       └── mappers.ts                      # (NEW) Convex doc ↔ domain mapper
└── index.ts             # (EXTEND) Export new types

src/shared/
└── event-dispatcher.ts  # (NEW) Generic typed event dispatcher (D-35)
```

### Pattern 1: Domain Event Dispatcher (D-35)

**What:** Lightweight synchronous event bus for in-process domain events.
**When to use:** Decoupling side-effects (audit logging) from core business logic without external messaging infra.
**Example:**

```typescript
// src/shared/event-dispatcher.ts
type EventHandler<T> = (event: T) => void | Promise<void>;

export class EventDispatcher<EventMap extends Record<string, unknown>> {
  private handlers = new Map<string, EventHandler<unknown>[]>();

  on<K extends keyof EventMap & string>(type: K, handler: EventHandler<EventMap[K]>): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler as EventHandler<unknown>);
    this.handlers.set(type, list);
  }

  async emit<K extends keyof EventMap & string>(type: K, event: EventMap[K]): Promise<void> {
    for (const h of this.handlers.get(type) ?? []) {
      await h(event);
    }
  }
}
```

### Pattern 2: Optimistic Concurrency (D-36)

**What:** Version-based conflict detection on mutable entities.
**When to use:** Preventing lost updates on draft edits without pessimistic locking.
**Example:**

```typescript
// In PolicyService.saveDraft():
async saveDraft(ctx: TenantContext, versionId: PolicyVersionId, content: unknown, expectedRevision: number): Promise<PolicyVersion> {
  const version = await this.versionRepo.findById(ctx, versionId);
  if (!version) throw new DraftNotFoundError(versionId);
  if (version.status !== 'draft') throw new ImmutableVersionError(versionId);
  if (version.revision !== expectedRevision) throw new ConflictError(versionId, expectedRevision, version.revision);

  // Validate content (D-34: validation runs on every save)
  const result = this.validator.validate(content);
  const validationStatus = result.ok ? 'valid' : 'invalid';
  const validationErrors = result.ok ? [] : result.errors;

  return this.versionRepo.update(ctx, versionId, {
    content,
    validationStatus,
    validationErrors,
    revision: version.revision + 1,
  });
}
```

### Pattern 3: Rollback as Forward Clone (D-33)

**What:** Creating a new draft version with content copied from a historical version.
**When to use:** Implementing rollback without mutating historical versions.
**Example:**

```typescript
async rollback(ctx: TenantContext, policyId: PolicyId, targetVersionId: PolicyVersionId): Promise<PolicyVersion> {
  const targetVersion = await this.versionRepo.findById(ctx, targetVersionId);
  if (!targetVersion) throw new VersionNotFoundError(targetVersionId);

  // NOTE: getNextVersionNumber() query-max-plus-1 is acceptable for MVP.
  // Future production implementations must allocate atomically within a single transaction.
  const nextNumber = await this.versionRepo.getNextVersionNumber(ctx, policyId);

  const draft = await this.versionRepo.create(ctx, {
    policyId,
    versionNumber: nextNumber,
    content: targetVersion.content, // Clone content from target
    status: 'draft',
    // Do NOT re-run validation — clone directly from source version.
    // Historical published versions are already validated.
    // Avoids coupling rollback behavior to future validator changes.
    validationStatus: targetVersion.validationStatus,
    validationErrors: targetVersion.validationErrors,
    revision: 0,
    rollbackFromVersionId: targetVersionId,
    createdBy: ctx.actorId,
  });

  // Rollback emits DraftCreated with rollbackFromVersionId != null.
  // There is no separate PolicyRolledBack event.
  await this.dispatcher.emit('DraftCreated', { ...draft });
  return draft;
}
```

### Anti-Patterns to Avoid

- **Mutating published versions:** Once `status='published'`, no field except lookup indexes should change. Service layer must hard-reject any mutation attempt.
- **Validating at draft storage time as a gate:** Validation is informational on save (updates `validationStatus`), not a gate. Only publish checks `validationStatus === 'valid'` (D-34).
- **Duplicating policy content in audit logs:** Audit records reference `policyVersionId`, never store content (D-37). Content lives in the immutable `PolicyVersion`.
- **External messaging for audit:** D-35 explicitly bans Kafka/RabbitMQ. Use synchronous in-process dispatch.
- **Decreasing version numbers:** Version numbers are strictly monotonic (D-33). Never reuse or decrement.

## Don't Hand-Roll

| Problem                 | Don't Build      | Use Instead                                                                   | Why                                           |
| ----------------------- | ---------------- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| JSON Schema validation  | Custom validator | `SchemaValidatorPort` + `AjvSchemaValidator` from `runtime/`                  | Already built in Phase 2; D-34 requires reuse |
| Branded ID construction | Raw string casts | `policyId()`, `policyVersionId()`, `auditLogId()` from existing domain/ids.ts | Type safety via branded types                 |
| Convex adapter patterns | New patterns     | Follow `convex-role-repository.ts` and `convex-user-repository.ts` patterns   | Consistency with Phase 1 adapters             |

## Common Pitfalls

### Pitfall 1: Convex Schema Migration

**What goes wrong:** Adding new fields to `policyVersions` (status, validationStatus, validationErrors, revision, rollbackFromVersionId, createdBy) requires updating `convex/schema.ts` and running `npx convex dev` to regenerate types.
**Why it happens:** Convex codegen must run after schema changes for types to be available.
**How to avoid:** Update `convex/schema.ts` FIRST as a blocking task, then run codegen, then implement adapters.
**Warning signs:** TypeScript errors referencing missing fields on Convex document types.

### Pitfall 2: Cross-Module Import Violation

**What goes wrong:** `PolicyService` needs `SchemaValidatorPort` from `runtime/`. Direct deep imports (`from '../../runtime/ports/...'`) violate D-08 module boundary rules.
**Why it happens:** Reaching for the shortest import path.
**How to avoid:** Import ONLY through module barrels: `import { SchemaValidatorPort } from '@/modules/runtime/index.js'`. The runtime barrel already exports `SchemaValidatorPort`.
**Warning signs:** ESLint no-restricted-paths rule fires.

### Pitfall 3: Version Number Race Condition

**What goes wrong:** Two concurrent `createDraft` calls could assign the same `versionNumber`.
**Why it happens:** `getNextVersionNumber` reads max version, then `create` writes — non-atomic.
**How to avoid:** In Convex, use a mutation that atomically queries max version and creates the new record. For in-memory fakes, use a simple counter.
**Warning signs:** Duplicate version numbers in test output.

### Pitfall 4: TenantContext Missing from Service Methods

**What goes wrong:** Forgetting to pass `ctx: TenantContext` as the first parameter to every service method.
**Why it happens:** Habit from non-multi-tenant codebases.
**How to avoid:** Follow `RoleService` pattern exactly — every method signature starts with `ctx: TenantContext`.
**Warning signs:** Tenant isolation tests fail; data leaks across tenants.

### Pitfall 5: PolicyVersion.content Type Narrowing

**What goes wrong:** `PolicyVersion.content` is typed as `unknown` in the Phase 1 skeleton. Phase 3 needs to pass it to `SchemaValidatorPort.validate(content: unknown)` — this works. But code may try to access `content.rules` without validation.
**Why it happens:** Assuming content shape without validation.
**How to avoid:** Always validate through `SchemaValidatorPort` first. The `ValidationSuccess` result narrows `content` to `PolicyContent`. Never cast `content` directly.
**Warning signs:** Runtime `TypeError: Cannot read property 'rules' of undefined`.

## Code Examples

### PolicyVersion Extended Interface

```typescript
// src/modules/policy/domain/policy-version.ts (extended)
import type { TenantId, UserId } from "@/modules/directory/index.js";
import type { PolicyId, PolicyVersionId } from "./ids.js";
import type { ValidationError } from "@/modules/runtime/index.js";

export type PolicyVersionStatus = "draft" | "published";
export type ValidationStatus = "valid" | "invalid" | "unchecked";

export interface PolicyVersion {
  readonly id: PolicyVersionId;
  readonly tenantId: TenantId;
  readonly policyId: PolicyId;
  readonly versionNumber: number;
  readonly content: unknown;
  readonly status: PolicyVersionStatus;
  readonly validationStatus: ValidationStatus;
  readonly validationErrors: readonly ValidationError[];
  readonly revision: number;
  readonly rollbackFromVersionId: PolicyVersionId | null;
  readonly createdBy: UserId;
  readonly createdAt: number;
  readonly publishedAt: number | null;
}
```

### Domain Events (D-35)

```typescript
// src/modules/policy/domain/policy-events.ts
import type { PolicyId, PolicyVersionId } from "./ids.js";
import type { TenantId, UserId } from "@/modules/directory/index.js";

export interface DraftCreatedEvent {
  readonly tenantId: TenantId;
  readonly policyId: PolicyId;
  readonly policyVersionId: PolicyVersionId;
  readonly versionNumber: number;
  readonly actorId: UserId;
  readonly rollbackFromVersionId: PolicyVersionId | null;
  readonly timestamp: number;
}

export interface DraftUpdatedEvent {
  readonly tenantId: TenantId;
  readonly policyId: PolicyId;
  readonly policyVersionId: PolicyVersionId;
  readonly versionNumber: number;
  readonly actorId: UserId;
  readonly timestamp: number;
}

export interface PolicyPublishedEvent {
  readonly tenantId: TenantId;
  readonly policyId: PolicyId;
  readonly policyVersionId: PolicyVersionId;
  readonly versionNumber: number;
  readonly actorId: UserId;
  readonly timestamp: number;
}

// NOTE: No PolicyRolledBackEvent — rollback is modeled as DraftCreated
// with rollbackFromVersionId != null, followed by PolicyPublished.
// Audit subscribers infer rollback from rollbackFromVersionId.

export type PolicyEventMap = {
  DraftCreated: DraftCreatedEvent;
  DraftUpdated: DraftUpdatedEvent;
  PolicyPublished: PolicyPublishedEvent;
  // No PolicyRolledBack — rollback is modeled as DraftCreated
  // with rollbackFromVersionId != null, followed by PolicyPublished.
};
```

## Validation Architecture

### Test Framework

| Property           | Value                                                     |
| ------------------ | --------------------------------------------------------- |
| Framework          | Vitest 3.x                                                |
| Config file        | `vitest.config.ts`                                        |
| Quick run command  | `npx vitest run tests/modules/policy/ --reporter=verbose` |
| Full suite command | `npx vitest run --coverage`                               |

### Phase Requirements → Test Map

| Req ID | Behavior                             | Test Type | Automated Command                                                             | File Exists? |
| ------ | ------------------------------------ | --------- | ----------------------------------------------------------------------------- | ------------ |
| POL-01 | Create policy with JSON rule content | unit      | `npx vitest run tests/modules/policy/policy-service.test.ts -t "createDraft"` | ❌ Wave 1    |
| POL-02 | Publishing policies                  | unit      | `npx vitest run tests/modules/policy/policy-service.test.ts -t "publish"`     | ❌ Wave 1    |
| POL-03 | Published versions reject mutations  | unit      | `npx vitest run tests/modules/policy/policy-service.test.ts -t "immutab"`     | ❌ Wave 1    |
| POL-04 | Active version tracking + rollback   | unit      | `npx vitest run tests/modules/policy/policy-service.test.ts -t "rollback"`    | ❌ Wave 2    |
| AUD-01 | Audit records on publish/rollback    | unit      | `npx vitest run tests/modules/audit/audit-subscriber.test.ts`                 | ❌ Wave 2    |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/modules/policy/ --reporter=verbose`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/modules/policy/policy-service.test.ts` — covers POL-01, POL-02, POL-03, POL-04
- [ ] `tests/modules/policy/event-dispatcher.test.ts` — covers event dispatch
- [ ] `tests/modules/audit/audit-subscriber.test.ts` — covers AUD-01
- [ ] `tests/_helpers/in-memory-fakes.ts` — extend with policy + audit fakes

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                            |
| --------------------- | ------- | --------------------------------------------------------------------------- |
| V2 Authentication     | No      | N/A (Phase 3 has no auth layer)                                             |
| V3 Session Management | No      | N/A                                                                         |
| V4 Access Control     | Yes     | TenantContext isolation on every service method; `createdBy` actor tracking |
| V5 Input Validation   | Yes     | JSON Schema validation via `SchemaValidatorPort` at publish boundary        |
| V6 Cryptography       | No      | N/A                                                                         |

### Known Threat Patterns

| Pattern                       | STRIDE                 | Standard Mitigation                                                       |
| ----------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| Tenant data leakage           | Information Disclosure | TenantContext passed explicitly; all queries scoped by tenantId           |
| Unauthorized version mutation | Tampering              | Immutability check at service layer; published versions reject all writes |
| Audit log tampering           | Tampering              | Audit records are append-only; no update/delete operations exposed        |
| Concurrent draft corruption   | Tampering              | Optimistic concurrency control with `revision` field (D-36)               |

## Assumptions Log

| #   | Claim | Section | Risk if Wrong |
| --- | ----- | ------- | ------------- |
| —   | —     | —       | —             |

**All claims in this research were verified against the existing codebase or derived from locked CONTEXT.md decisions — no user confirmation needed.**

## Open Questions

None — all decisions are locked in CONTEXT.md (D-32 through D-37).

## Sources

### Primary (HIGH confidence)

- Existing codebase: `src/modules/policy/`, `src/modules/audit/`, `src/modules/runtime/`, `src/modules/directory/`
- `convex/schema.ts` — current Convex schema definition
- `.planning/phases/03-policy-lifecycle/03-CONTEXT.md` — locked decisions D-32..D-37
- `.planning/REQUIREMENTS.md` — POL-01..04, AUD-01
- `.planning/PROJECT.md` — architecture constraints, concept hierarchy

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new external dependencies; all patterns from existing codebase
- Architecture: HIGH — follows established hexagonal patterns from Phase 1 directory module
- Pitfalls: HIGH — identified from direct codebase analysis of Phase 1/2 patterns

**Research date:** 2026-06-01
**Valid until:** 2026-07-01 (stable — internal patterns, no external dependency changes)
