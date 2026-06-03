# Phase 4: Request Runtime - Research

**Researched:** 2026-06-03
**Domain:** Application-layer orchestration (hexagonal TS modular monolith) — request intake, policy resolution, deterministic evaluation, persistence, by-reference audit
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-38 — Decision Record Persistence (dedicated operational table).** Evaluation results stored in a dedicated operational table `RequestEvaluation` (a.k.a. DecisionRecord), separate from the governance ledger.

- `RequestEvaluation` stores: `tenantId`, `requestType`, `requestInput`, `policyVersionId`, `evaluationResult`, `decision`, `trace`, `status`, `createdAt`.
- Audit logs remain by-reference (D-37): an `AuditLog` entry stores `eventType`, `evaluationRecordId`, `actorId`, `timestamp` — never the input/trace content.
- Workload split: operational queries hit `RequestEvaluation`; governance/audit queries hit `AuditLog`.
- Pattern reuse: service emits a domain event, `AuditEventSubscriber` persists the by-reference audit record via `EventDispatcher`.

**D-39 — Policy Resolution (machine-readable `requestType`).** `Policy` owns a dedicated machine-readable `requestType` field for runtime routing.

- `Policy.name` — human-readable, editable, display-only.
- `Policy.requestType` — stable routing key, used by runtime resolution, immutable after creation (recommended).
- Resolution path: `tenantId + requestType → Policy → activeVersionId → PolicyVersion`.
- Uniqueness: `tenantId + requestType` is unique (enforced in the application layer, consistent with the existing `[tenantId, name]` role-uniqueness pattern).

**D-40 — Evaluation Failure (contract violations).** An `EvaluationError` (MISSING_FIELD / TYPE_MISMATCH / UNSUPPORTED_OPERATOR, per D-28) does NOT produce a Decision.

- Persist a `RequestEvaluation` with `status = 'failed'`, `decision = null`, `errorCode` stored, `fieldPath` stored when applicable, and the partial trace up to the failure point.
- After persistence: emit an `EvaluationFailed` domain event → create an `AuditLog` by-reference.
- Finally: rethrow / surface the `EvaluationError` to the caller.
- Contract violations stay distinct from business decisions — a malformed request is never silently coerced into an auto-reject.

**D-41 — Resolution Failure (preconditions).** Policy-resolution failures (`PolicyNotFoundForRequestType`, `NoActivePolicyError`) are precondition failures that occur _before_ evaluation begins.

- No `RequestEvaluation` record is created (a record always corresponds to a concrete resolved `PolicyVersion`).
- No nullable `policyVersionId` is introduced — `RequestEvaluation.policyVersionId` stays non-null.
- The error is surfaced to the caller.
- A lightweight audit event is emitted for observability.

**D-42 — Trace Persistence (minimal deterministic replay).**

- Persist: `requestInput`, `policyVersionId`, `decision`, `trace[] = { ruleId, matched }`.
- Do NOT persist: `field`, `operator`, `expectedValue`, `actualValue`.
- Governance and UI reconstruct exact decision paths by replaying `PolicyVersion.content` + `requestInput` + `trace`.
- `PolicyVersion` remains the canonical source of rule definitions; `trace` the canonical source of execution order and match results. No duplication (respects D-37); no change to the Phase 2 evaluator contract.

### Claude's Discretion

- **Module placement** — a new `request/` (or `runtime-orchestration/`) module housing `PolicyRuntimeService` + `RequestEvaluation` entity + ports/adapters, mirroring the Phase 1/2/3 module shape (`domain/application/ports/adapters/index.ts/README.md`). Must not introduce cross-module coupling (D-08); `Decision`/`EvaluationResult` come from `runtime/`'s barrel, `Policy`/`getActiveVersion` from `policy/`'s barrel.
- **Domain event names** — e.g. `RequestEvaluated` (success), `EvaluationFailed` (contract violation), and a resolution-failure observability event. Originating module owns the event constants; audit `eventType` strings follow `<aggregate>.<action>` (e.g. `request.evaluated`, `request.evaluation_failed`, `request.resolution_failed`).
- **Re-validation at submit** — whether `PolicyRuntimeService` calls `validateAndEvaluate` (re-runs schema validation, RUN-03 defense-in-depth) vs. trusting that published versions are already valid. Either is acceptable; default toward `validateAndEvaluate` to keep the evaluator structurally unreachable on invalid content.
- **`RequestEvaluation` branded ID + status enum** — follow the Phase 1 branded-ID pattern; `status` is a small union (e.g. `'completed' | 'failed'`).
- **`createPolicy` signature evolution** — how `requestType` is threaded into policy creation and where uniqueness is enforced (likely in `PolicyService.createPolicy`).
- **Convex handler wiring** — thin DI assembly only (convex/ HARD RULE); no orchestration logic in `convex/`.
- **Test fixtures** — request-submission → expected RequestEvaluation tuples; co-located unit tests with in-memory repositories.

### Deferred Ideas (OUT OF SCOPE)

- **Decision Consumers acting on persisted Decisions** — approval routing (Phase 5, DEC-03), notifications/webhooks (v2, DEC-06). Phase 4 emits/persists the Decision and stops there.
- **Request submission UI + request-log visualization** — Phase 6 (UI-02, UI-04).
- **Idempotency / `requestId` dedup on submission** — not in Phase 4. `TenantContext` is already extensible to carry `requestId` later without signature churn.
- **Materialized rich trace** (operator/field/expected/actual per step) — explicitly rejected for v1 (D-42) in favor of replay.
- **AND/OR/NOT operators, nested context, type coercion** — v2 / rejected per Phase 2 (D-25/D-26/D-27).
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID     | Description                                                                                                                                    | Research Support                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DEC-01 | Evaluate an `EvaluationContext` against active JSON policies → structured Decision (Auto-Approve / Auto-Reject / Request-Approval; type open). | `PolicyRuntimeService.submit(ctx, {requestType, input})` resolves `tenantId+requestType → Policy → activeVersionId → PolicyVersion` (reuses `PolicyService.getActiveVersion`) then calls `validateAndEvaluate(validator, version.content, input)` (runtime barrel) → returns the `Decision` inside `EvaluationResult`. See Architecture Pattern 1 + Code Examples. |
| AUD-02 | Audit records tracking the exact decision path of evaluations.                                                                                 | Two-store split (D-38): full `trace[]={ruleId,matched}` persisted on `RequestEvaluation`; `AuditLog` stores by-reference envelope (`evaluationRecordId`, `eventType`, `actorId`). Exact path reconstructed by replay (D-42) of `PolicyVersion.content + requestInput + trace`. Audit wired via `EventDispatcher` → `AuditEventSubscriber` extension (Pattern 3).   |

</phase_requirements>

## Summary

Phase 4 is a pure **application-orchestration + persistence** phase inside an established hexagonal TypeScript modular monolith. There is **no new external technology** — every primitive needed (Convex 1.39.1 persistence, Vitest 4.1.7 test runner, Ajv 8.17.1 validator behind `SchemaValidatorPort`, branded-ID/error/mapper/in-memory-fake templates, the `EventDispatcher`/`AuditEventSubscriber` audit pattern) already ships in the repo from Phases 1–3. The research task is therefore not "what libraries" but "what existing seams to wrap and what patterns to mirror exactly."

The single load-bearing seam is `validateAndEvaluate(validator, content, ctx)` in `src/modules/runtime/application/policy-runtime.ts` — its own header comment names Phase 4 as the orchestration layer that wraps it with `TenantContext` + persistence + audit. The second seam is `PolicyService.getActiveVersion(ctx, policyId)`. Phase 4 adds the missing piece between them: resolving a `requestType` to a `policyId` (requiring a `requestType` field + index on `policies`, a `createPolicy` signature change, and application-layer `[tenantId, requestType]` uniqueness — a Phase-3-touching change that demands GitNexus impact analysis on `Policy` / `PolicyService.createPolicy`).

The three outcome paths (D-40/D-41/D-42) are the heart of the design and the testing strategy: **success** → persist `completed` record + `RequestEvaluated` event + audit; **contract violation** (`EvaluationError`) → persist `failed` record with partial trace + `EvaluationFailed` event + **rethrow**; **resolution failure** → **no record**, lightweight audit event, rethrow. The trace persists minimally (`{ruleId, matched}`) and rich detail is reconstructed by deterministic replay of the immutable `PolicyVersion.content` (POL-03 immutability is what makes replay faithful).

**Primary recommendation:** Create a new `src/modules/request/` module mirroring the exact `{domain, application, ports, adapters, index.ts, README.md}` shape of `policy/`. Implement `PolicyRuntimeService.submit(ctx, input)` that orchestrates resolve → `validateAndEvaluate` (default to re-validation for RUN-03 defense-in-depth) → persist → emit. Reuse `policy/` and `runtime/` strictly through their barrels (D-08). Extend `policies` schema + `createPolicy` for `requestType` (run GitNexus impact first). Add a `request.*` `AuditEventSubscriber` (separate `EventDispatcher<RequestEventMap>` instance). Test service-first with in-memory fakes (D-20), one in-memory `RequestEvaluation` repo, three outcome-path suites, and a deterministic-replay assertion.

## Architectural Responsibility Map

| Capability                               | Primary Tier                                                        | Secondary Tier                              | Rationale                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Request intake (`{requestType, input}`)  | Convex handler (thin DI)                                            | API/backend (`PolicyRuntimeService.submit`) | convex/ HARD RULE: handler only validates arg shape + wires DI; orchestration lives in the service.         |
| `requestType → PolicyVersion` resolution | Application (`PolicyRuntimeService`)                                | Application (`PolicyService` via barrel)    | Resolution is business orchestration; reuses `getActiveVersion`, never deep-imports policy internals.       |
| Schema validation + rule evaluation      | Application (`runtime/` pure core)                                  | —                                           | `validateAndEvaluate` is the pure deterministic core (RUN-02/RUN-03). Phase 4 calls it; never reimplements. |
| `RequestEvaluation` persistence          | Adapter (Convex repo) behind port                                   | Adapter (in-memory fake for tests)          | Hexagonal: service depends on a `RequestEvaluationRepositoryPort`; adapters implement it.                   |
| Decision-path trace storage              | Adapter (Convex `requestEvaluations` table)                         | —                                           | Operational store (D-38); full trace lives here, not in audit.                                              |
| By-reference audit record                | Application (`AuditEventSubscriber`) → Adapter (Convex `auditLogs`) | —                                           | Governance ledger (D-37); reference envelope only, populated reactively via event.                          |
| Domain event emission                    | Application (`PolicyRuntimeService` via `EventDispatcher`)          | —                                           | Synchronous in-process bus (D-35); decouples persistence from audit.                                        |
| `requestType` uniqueness enforcement     | Application (`PolicyService.createPolicy`)                          | —                                           | Matches existing `[tenantId, name]` role pattern — app-layer check, not a DB constraint.                    |

## Standard Stack

**No new packages.** This phase uses only what is already installed and wired. Verified against the live `package.json` and lockfile in the repo.

### Core

| Library             | Version     | Purpose                                                                                                        | Why Standard                                                                                                        |
| ------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `convex`            | 1.39.1      | Persistence — `requestEvaluations` table + `policies.requestType` migration; thin `convex/request.ts` handlers | [VERIFIED: package.json] Already the platform's datastore; schema + adapter conventions established Phases 1–3.     |
| `vitest`            | 4.1.7       | Test runner for service-first unit tests + replay tests                                                        | [VERIFIED: package.json] All existing tests use it; scripts `test`, `test:coverage` wired.                          |
| `ajv`               | 8.17.1      | JSON Schema validator behind `SchemaValidatorPort` (consumed via `AjvSchemaValidator`)                         | [VERIFIED: package.json] Already wired in `runtime/`; reused via `validateAndEvaluate` for RUN-03 defense-in-depth. |
| TypeScript (strict) | repo-pinned | Branded IDs, discriminated unions, pure domain interfaces                                                      | [VERIFIED: tsconfig + eslint] `@typescript-eslint/no-explicit-any: error`; no `any`, no `eval()`.                   |

### Supporting

| Library                | Version   | Purpose                                            | When to Use                                                                                                                                                                                       |
| ---------------------- | --------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex-helpers`       | installed | `brandedString` validators in `convex/_branded.ts` | If a branded `RequestEvaluationId` arg ever crosses a Convex handler boundary as a string (likely not needed — IDs are returned, not taken, on submit). [VERIFIED: convex/_branded.ts imports it] |
| `eslint-plugin-import` | installed | `import/no-restricted-paths` module-boundary zones | MUST add a new zone for `src/modules/request/` (Pattern: D-08 zones). [VERIFIED: eslint.config.js]                                                                                                |

### Alternatives Considered

| Instead of                                  | Could Use                                                  | Tradeoff                                                                                                                                                                                                                                                    |
| ------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New `request/` module                       | Add `PolicyRuntimeService` into existing `runtime/` module | REJECTED. `runtime/` is the _pure_ core (PROJECT.md Concept #4). Adding persistence/audit/`TenantContext` there violates its purity and the Concept Hierarchy. New module keeps the pure core untouched.                                                    |
| Separate `EventDispatcher<RequestEventMap>` | Reuse policy's `EventDispatcher<PolicyEventMap>`           | Use a SEPARATE instance typed to `RequestEventMap`. `EventDispatcher` is generic over its own `EventMap`; mixing policy + request events into one map couples the modules. Each originating module owns its event constants (D-08, established pattern).    |
| Re-validate via `validateAndEvaluate`       | Call `evaluate()` directly on trusted published content    | Default to `validateAndEvaluate` (CONTEXT.md discretion). Re-validation keeps the evaluator structurally unreachable on invalid content (RUN-03 defense-in-depth) at negligible cost; published versions are already `valid` so it never fails in practice. |

**Installation:** None. Confirm no new dependency is added — `package.json` must be unchanged by this phase except possibly devDependency-free.

## Package Legitimacy Audit

> Not applicable. Phase 4 installs **zero** external packages. All dependencies (`convex` 1.39.1, `vitest` 4.1.7, `ajv` 8.17.1, `convex-helpers`, `eslint-plugin-import`) were vetted and installed in Phases 1–3 and are confirmed present in the repo lockfile. No new registry fetches occur. If the planner finds itself adding a package, treat that as a scope/design error and stop.

## Architecture Patterns

### System Architecture Diagram

```
                  Convex handler: convex/request.ts  (thin DI only — HARD RULE)
                  validates {tenantId, requestType, input}, wires deps
                            │
                            ▼
        ┌──────────────────────────────────────────────────────────┐
        │  PolicyRuntimeService.submit(ctx: TenantContext, input)    │  (src/modules/request/application)
        └──────────────────────────────────────────────────────────┘
                            │
            (1) RESOLVE     ▼
        resolve requestType → policyId  (request module's resolution port / PolicyService barrel)
        PolicyService.getActiveVersion(ctx, policyId)  ──►  PolicyVersion | null
                            │
              null ─────────┴───────────► (D-41) PRECONDITION FAILURE
                            │                 • NO RequestEvaluation record
                            │                 • emit request.resolution_failed (lightweight)
                            │                 • throw PolicyNotFoundForRequestType / NoActivePolicyError
                            ▼
            (2) EVALUATE
        validateAndEvaluate(validator, version.content, input)   [runtime barrel — pure core, reused as-is]
                            │
            ┌───────────────┴────────────────┐
       success                          throws EvaluationError  (D-40 contract violation)
            │                                 │
   (3a) PERSIST completed            (3b) PERSIST failed
   RequestEvaluation{                RequestEvaluation{
     status:'completed',               status:'failed',
     decision, trace,                  decision:null, errorCode,
     requestInput, policyVersionId }   fieldPath, partial trace,
            │                          requestInput, policyVersionId }
            │                                 │
   emit "RequestEvaluated"            emit "EvaluationFailed"
            │                                 │
            │                          rethrow EvaluationError ──► caller
            ▼                                 ▼
   ┌──────────────────────────────────────────────────────────┐
   │  EventDispatcher<RequestEventMap>  (synchronous, in-process — D-35) │
   └──────────────────────────────────────────────────────────┘
                            │
                            ▼
        AuditEventSubscriber (request.*)  ──►  AuditLogRepositoryPort
        persists by-reference envelope { evaluationRecordId, actorId, ... }  (D-37, never content)
                            │
                            ▼
                  ┌────────────────────┐        ┌────────────────────┐
                  │ requestEvaluations │        │     auditLogs       │
                  │ (operational store)│        │ (governance ledger) │
                  └────────────────────┘        └────────────────────┘

  REPLAY (D-42, on-demand, governance/UI — Phase 6, NOT built here):
     PolicyVersion.content (immutable, POL-03) + requestInput + trace[]  ──► exact decision path
```

### Recommended Project Structure

```
src/modules/request/                     # NEW module, mirrors policy/ exactly
├── domain/
│   ├── ids.ts                           # RequestEvaluationId branded string + factory (D-14/D-15)
│   ├── request-evaluation.ts            # RequestEvaluation entity (plain TS interface, D-13)
│   ├── request-evaluation-status.ts     # 'completed' | 'failed' union
│   └── request-events.ts                # RequestEventMap + RequestEvaluated/EvaluationFailed/ResolutionFailed events
├── application/
│   ├── policy-runtime-service.ts        # PolicyRuntimeService.submit (TenantContext first — D-19)
│   └── errors.ts                        # PolicyNotFoundForRequestType, NoActivePolicyError
├── ports/
│   ├── request-evaluation-repository.port.ts   # create/findById/findByTenant
│   └── policy-resolution.port.ts        # OPTIONAL: requestType→policyId lookup (or do via PolicyService barrel)
├── adapters/
│   ├── convex/
│   │   ├── convex-request-evaluation-repository.ts
│   │   └── mappers.ts                   # to/from RequestEvaluationId + toRequestEvaluationDomain
│   └── memory/
│       └── in-memory-request-evaluation-repository.ts   # test fake (D-20)
├── index.ts                             # barrel — the ONLY cross-module surface
└── README.md

src/modules/audit/application/
└── request-audit-subscriber.ts          # NEW: request.* subscriber (or extend existing pattern)

convex/
├── schema.ts                            # ADD requestEvaluations table + policies.requestType field/index
└── request.ts                           # NEW thin handlers (submit + queries)

tests/modules/request/                   # co-located service-first tests
├── policy-runtime-service.test.ts       # 3 outcome paths
├── replay.test.ts                       # D-42 deterministic replay verification
└── request-audit-subscriber.test.ts     # by-reference audit assertions
```

### Pattern 1: Service wraps the pure seam with TenantContext + persistence + audit

**What:** `PolicyRuntimeService.submit` is the orchestrator. Takes `ctx: TenantContext` first (D-19), resolves the active version, calls the pure `validateAndEvaluate`, persists, emits.
**When to use:** This is THE phase deliverable.
**Example:**

```typescript
// Source: synthesized from src/modules/policy/application/policy-service.ts (getActiveVersion, ctor DI)
//         + src/modules/runtime/application/policy-runtime.ts (validateAndEvaluate seam)
import type { TenantContext } from "@/modules/directory/index.js";
import {
  validateAndEvaluate,
  type SchemaValidatorPort,
  EvaluationError,
} from "@/modules/runtime/index.js";
import { PolicyService } from "@/modules/policy/index.js"; // barrel only (D-08)
import type { RequestEvaluationRepositoryPort } from "../ports/request-evaluation-repository.port.js";
import type { EventDispatcher } from "@/shared/event-dispatcher.js";
import type { RequestEventMap } from "../domain/request-events.js";
import { PolicyNotFoundForRequestType, NoActivePolicyError } from "./errors.js";

export class PolicyRuntimeService {
  constructor(
    private readonly policyService: PolicyService, // reuse getActiveVersion via barrel
    private readonly resolveByRequestType: /* port */ (
      ctx: TenantContext,
      rt: string,
    ) => Promise<PolicyId | null>,
    private readonly validator: SchemaValidatorPort, // AjvSchemaValidator injected
    private readonly evalRepo: RequestEvaluationRepositoryPort,
    private readonly dispatcher: EventDispatcher<RequestEventMap>,
  ) {}

  async submit(
    ctx: TenantContext,
    input: { requestType: string; context: EvaluationContext },
  ): Promise<RequestEvaluation> {
    // (1) RESOLVE — precondition (D-41): failure → NO record, lightweight audit, rethrow
    const policyId = await this.resolveByRequestType(ctx, input.requestType);
    if (!policyId) {
      await this.dispatcher.emit("ResolutionFailed", {
        tenantId: ctx.tenantId,
        requestType: input.requestType,
        reason: "POLICY_NOT_FOUND",
        timestamp: Date.now(),
      });
      throw new PolicyNotFoundForRequestType(input.requestType);
    }
    const version = await this.policyService.getActiveVersion(ctx, policyId);
    if (!version) {
      await this.dispatcher.emit("ResolutionFailed", {
        tenantId: ctx.tenantId,
        requestType: input.requestType,
        reason: "NO_ACTIVE_VERSION",
        timestamp: Date.now(),
      });
      throw new NoActivePolicyError(input.requestType);
    }

    // (2) EVALUATE — pure core, reused as-is (RUN-03 defense-in-depth via validateAndEvaluate)
    try {
      const result = validateAndEvaluate(this.validator, version.content, input.context);
      // (3a) SUCCESS — persist completed, emit
      const record = await this.evalRepo.create(ctx, {
        requestType: input.requestType,
        requestInput: input.context,
        policyVersionId: version.id,
        decision: result.decision,
        trace: result.evaluationTrace, // {ruleId, matched}[] only (D-42)
        status: "completed",
      });
      await this.dispatcher.emit("RequestEvaluated", {
        tenantId: ctx.tenantId,
        evaluationRecordId: record.id,
        /* actorId from ctx when present */ timestamp: Date.now(),
      });
      return record;
    } catch (err) {
      // (3b) CONTRACT VIOLATION (D-40) — persist failed + partial trace, emit, RETHROW
      if (err instanceof EvaluationError) {
        const record = await this.evalRepo.create(ctx, {
          requestType: input.requestType,
          requestInput: input.context,
          policyVersionId: version.id,
          decision: null,
          errorCode: err.code,
          fieldPath: err.field,
          trace: /* partial trace — see Open Question 1 */ [],
          status: "failed",
        });
        await this.dispatcher.emit("EvaluationFailed", {
          tenantId: ctx.tenantId,
          evaluationRecordId: record.id,
          errorCode: err.code,
          timestamp: Date.now(),
        });
        throw err; // surface to caller (D-40)
      }
      throw err; // PolicySchemaInvalidError etc. — not a contract violation, do not record as 'failed'
    }
  }
}
```

### Pattern 2: Branded ID + entity + status union (mirror policy/)

**What:** `RequestEvaluationId` is a branded string owned by the `request` module; entity is a plain readonly TS interface; status is a small union.
**When to use:** New entity definition.
**Example:**

```typescript
// Source: src/modules/policy/domain/ids.ts + src/modules/policy/domain/policy.ts
export type RequestEvaluationId = string & { readonly __brand: "RequestEvaluationId" };
export const requestEvaluationId = (raw: string): RequestEvaluationId => raw as RequestEvaluationId;

export type RequestEvaluationStatus = "completed" | "failed";

export interface RequestEvaluation {
  readonly id: RequestEvaluationId;
  readonly tenantId: TenantId;
  readonly requestType: string;
  readonly requestInput: EvaluationContext; // imported via runtime barrel
  readonly policyVersionId: PolicyVersionId; // non-null always (D-41)
  readonly decision: Decision | null; // null on failure (D-40)
  readonly trace: readonly TraceEntry[]; // {ruleId, matched} (D-42)
  readonly status: RequestEvaluationStatus;
  readonly errorCode: EvaluationErrorCode | null;
  readonly fieldPath: string | null;
  readonly createdAt: number; // epoch ms
}
```

### Pattern 3: by-reference audit subscriber for `request.*` (mirror AuditEventSubscriber)

**What:** A subscriber that listens on the request `EventDispatcher` and writes by-reference `AuditLog` rows. Reuses `AuditLogRepositoryPort` (already exported from `audit/` barrel).
**When to use:** Wiring AUD-02.
**Example:**

```typescript
// Source: src/modules/audit/application/audit-event-subscriber.ts (exact pattern)
export class RequestAuditSubscriber {
  constructor(
    private readonly auditRepo: AuditLogRepositoryPort,
    dispatcher: EventDispatcher<RequestEventMap>,
  ) {
    dispatcher.on("RequestEvaluated", async (e) => {
      await this.auditRepo.create(
        { tenantId: e.tenantId },
        {
          eventType: "request.evaluated",
          payload: {
            tenantId: e.tenantId,
            evaluationRecordId: e.evaluationRecordId,
            actorId: e.actorId,
          },
        },
      ); // by-reference only — NEVER input/decision/trace content (D-37)
    });
    dispatcher.on("EvaluationFailed", async (e) => {
      await this.auditRepo.create(
        { tenantId: e.tenantId },
        {
          eventType: "request.evaluation_failed",
          payload: {
            tenantId: e.tenantId,
            evaluationRecordId: e.evaluationRecordId,
            errorCode: e.errorCode,
          },
        },
      );
    });
    dispatcher.on("ResolutionFailed", async (e) => {
      await this.auditRepo.create(
        { tenantId: e.tenantId },
        {
          eventType: "request.resolution_failed",
          payload: { tenantId: e.tenantId, requestType: e.requestType, reason: e.reason }, // NO evaluationRecordId — none exists (D-41)
        },
      );
    });
  }
}
```

### Pattern 4: Convex schema extension (D-09 tenant-prefixed indexes)

```typescript
// Source: convex/schema.ts (existing policyVersions/policies tables show the convention)
policies: defineTable({
  tenantId: v.id("tenants"),
  name: v.string(),
  requestType: v.string(),                              // D-39 NEW — routing key
  activeVersionId: v.union(v.id("policyVersions"), v.null()),
  createdAt: v.number(),
})
  .index("by_tenant_name", ["tenantId", "name"])
  .index("by_tenant_request_type", ["tenantId", "requestType"]),  // D-39 NEW — resolution lookup

requestEvaluations: defineTable({                        // D-38 NEW operational table
  tenantId: v.id("tenants"),
  requestType: v.string(),
  requestInput: v.any(),                                 // EvaluationContext snapshot (mirrors policyVersions.content v.any())
  policyVersionId: v.id("policyVersions"),               // non-null (D-41)
  decision: v.union(v.any(), v.null()),                  // Decision union or null (D-40)
  trace: v.array(v.object({ ruleId: v.string(), matched: v.boolean() })),  // D-42 minimal
  status: v.string(),                                    // 'completed' | 'failed'
  errorCode: v.union(v.string(), v.null()),
  fieldPath: v.union(v.string(), v.null()),
  createdAt: v.number(),
})
  .index("by_tenant_created", ["tenantId", "createdAt"])
  .index("by_tenant_request_type", ["tenantId", "requestType"]),
```

### Anti-Patterns to Avoid

- **Deep-importing `policy/` or `runtime/` internals.** Use barrels only (`@/modules/policy/index.js`, `@/modules/runtime/index.js`). The new module MUST get its own `import/no-restricted-paths` zone in `eslint.config.js` or D-08 is silently unenforced for it.
- **Putting orchestration in `convex/request.ts`.** convex/ HARD RULE: validate args, instantiate deps, call `service.submit`, map response. No resolution/evaluation/persistence decisions there.
- **Storing trace/input/decision content in the audit payload.** Violates D-37. Audit is reference-only; the operational `RequestEvaluation` holds the data.
- **Materializing rich trace (field/operator/expected/actual).** Explicitly rejected (D-42). Persist `{ruleId, matched}` only; reconstruct by replay.
- **Treating `PolicySchemaInvalidError` as a `status:'failed'` business record.** D-40 is specifically about `EvaluationError` (MISSING_FIELD/TYPE_MISMATCH/UNSUPPORTED_OPERATOR). A schema-invalid published version is an integrity bug, not a request contract violation — let it throw without a `failed` record. (In practice it cannot occur: publish gate D-34 guarantees `valid` content.)
- **Nullable `policyVersionId` on `RequestEvaluation`.** Forbidden by D-41 — a record only ever exists for a concretely resolved version.
- **Coercing a malformed request into auto-reject.** Forbidden by D-40 — contract violations are distinct from decisions.

## Don't Hand-Roll

| Problem                               | Don't Build                                 | Use Instead                                                                              | Why                                                                                                                                             |
| ------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule evaluation / decision derivation | A second evaluator inside `request/`        | `validateAndEvaluate` from `runtime/` barrel                                             | Pure core is the single source of evaluation truth (RUN-02). Duplicating it forks behavior and breaks the no-`eval()` / determinism guarantees. |
| Active-version resolution             | New version-lookup query                    | `PolicyService.getActiveVersion(ctx, policyId)`                                          | Already handles tenant scoping + active pointer. Phase 4 only adds `requestType → policyId`.                                                    |
| Schema validation                     | Custom JSON checks                          | `AjvSchemaValidator` behind `SchemaValidatorPort`                                        | Wired in Phase 2; `validateAndEvaluate` already invokes it (RUN-03).                                                                            |
| Synchronous event fan-out             | Custom emitter / EventEmitter / pub-sub lib | `EventDispatcher<RequestEventMap>` from `@/shared/event-dispatcher.js`                   | Generic, in-process, sequential-await; the exact pattern audit already consumes (D-35).                                                         |
| By-reference audit persistence        | New audit writer                            | `AuditLogRepositoryPort` + a `request.*` subscriber                                      | Reuses `audit/` barrel; keeps D-37 reference-only invariant in one place.                                                                       |
| Branded-ID + mapper + in-memory fake  | Bespoke ID/repo plumbing                    | Copy `policy/domain/ids.ts`, `adapters/convex/mappers.ts`, `adapters/memory/*` templates | Established, tested shapes; deviating invites tenant-scoping or branding bugs.                                                                  |
| Rich decision-path detail             | Materialize operator/field/value per step   | Deterministic replay of immutable content + trace (D-42)                                 | POL-03 immutability makes replay faithful; materialization duplicates data and risks drift.                                                     |

**Key insight:** Phase 4 is ~90% composition of existing, tested seams. Almost every line that "does logic" should be a call into `runtime/` or `policy/` via their barrels. The genuinely new code is: the `RequestEvaluation` entity + repo, the `requestType` resolution + uniqueness, the three-path control flow in `submit`, and the `request.*` audit subscriber.

## Runtime State Inventory

> This phase adds a schema field (`policies.requestType`) and a new table. It is partly a schema migration, so the inventory is relevant.

| Category            | Items Found                                                                                                                                                                            | Action Required                                                                                                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stored data         | Existing `policies` rows (if any seeded in dev Convex) will lack `requestType`. New required `v.string()` field breaks reads of old rows under strict schema.                          | Decide: backfill existing dev rows with a `requestType` OR make the field tolerate existing data during migration. For a fresh dev deployment with no seeded policies, **None — verify by checking the dev Convex `policies` table is empty before deploy.** |
| Live service config | Convex schema is defined in `convex/schema.ts` (in git) and pushed via `convex dev`/`deploy`. No out-of-band UI-stored config.                                                         | Re-run `convex dev` (or `convex:deploy`) after schema edit so the new table + field + indexes register.                                                                                                                                                      |
| OS-registered state | None — no OS-level tasks, cron, or process names reference Phase 4 entities.                                                                                                           | None — verified: repo has no scheduler/launchd/pm2 artifacts referencing policy/request.                                                                                                                                                                     |
| Secrets/env vars    | None — no new secret or env var names. Convex deployment URL/keys unchanged.                                                                                                           | None — verified by grep of existing convex config: no Phase-4-specific secrets.                                                                                                                                                                              |
| Build artifacts     | TypeScript is compiled on the fly by Vitest/tsx and by Convex's bundler; no `egg-info`/compiled-binary equivalents. `convex/_generated/` regenerates from `schema.ts` on `convex dev`. | Re-run `convex dev` to regenerate `convex/_generated/dataModel.ts` so `Doc<"requestEvaluations">` types exist for the new mapper/adapter.                                                                                                                    |

**Canonical migration question — "after every file is updated, what runtime state still has the old shape?"** Answer: the dev/prod Convex `policies` table rows predating `requestType`. For local dev with no seeded policies this is empty (verify). The planner should include a task to (a) edit `schema.ts`, (b) run `convex dev` to regenerate types + push schema, (c) confirm no orphaned `policies` rows lack `requestType` (backfill or reset dev data if any exist).

## Common Pitfalls

### Pitfall 1: `policies.requestType` schema change is a Phase-3-touching breaking change

**What goes wrong:** Adding a required `requestType` to `policies` changes the `Policy` entity, the `createPolicy` signature, the Convex `toPolicyDomain` mapper, the in-memory `InMemoryPolicyRepository.create`, the policy Convex repository `create`, and `convex/` callers — across the `policy/` module that Phase 3 owns.
**Why it happens:** `requestType` lives on `Policy`, not on the new `request/` module.
**How to avoid:** Per CLAUDE.md, run GitNexus impact analysis BEFORE editing: `gitnexus_impact({target: "createPolicy", direction: "upstream"})` and `gitnexus_impact({target: "Policy", direction: "upstream"})`. Update every d=1 dependent: `PolicyRepositoryPort.create` input type, both repo adapters, `toPolicyDomain` mapper, the `policies` table validator, and any `createPolicy` call site (tests). Existing `policy-service.test.ts` `createPolicy` test (lines 35–45) WILL break and must be updated.
**Warning signs:** TypeScript errors in `convex/schema.ts` validator, `mappers.ts`, in-memory fake, or `policy-service.test.ts` after the field is added.

### Pitfall 2: Forgetting the new ESLint module-boundary zone

**What goes wrong:** Code in other modules deep-imports `src/modules/request/{domain,application,adapters}` and the linter stays silent because no zone protects the new module.
**Why it happens:** `import/no-restricted-paths` zones are per-module and enumerated by hand in `eslint.config.js` (lines 26–47). Each module has its own `target: "./src/modules/!(X)/**/*"` block.
**How to avoid:** Add a `request` zone mirroring the existing four. Also confirm the generic `domain↛application/adapters` and `application↛adapters` zones (lines 48–57) and the two `convex/` zones cover the new files automatically (they use `src/modules/*` globs, so they do).
**Warning signs:** A cross-module deep import compiles and lints clean.

### Pitfall 3: Partial trace on contract violation may be unavailable

**What goes wrong:** D-40 requires persisting "the partial trace up to the failure point," but `validateAndEvaluate` throws the `EvaluationError` and discards the in-progress `trace[]` — the evaluator builds `trace` locally and never returns it when it throws (see `src/modules/runtime/application/evaluator.ts`: `trace` is a local array; on throw it is lost).
**Why it happens:** The pure evaluator's error path does not expose accumulated trace; the `EvaluationError` carries only `code` + `field`, not partial trace.
**How to avoid:** This is the central Open Question (below). Options without modifying the Phase 2 contract (which CONTEXT.md forbids): (a) persist `trace: []` plus `errorCode`/`fieldPath` and accept that "partial trace" degenerates to empty for v1 — replay can still reconstruct up to the failing rule from `errorCode`/`fieldPath`; (b) the planner flags a minimal, additive change to surface partial trace. **Default: option (a)** — it honors "do not modify the evaluator contract" (D-42, Phase 2 D-28/D-30) and keeps `field/operator/value` unmaterialized. The planner must make this explicit.
**Warning signs:** A test asserting non-empty `trace` on a `failed` record fails because the evaluator threw before returning.

### Pitfall 4: Wiring two `EventDispatcher` instances correctly in the composition root

**What goes wrong:** Reusing the policy `EventDispatcher<PolicyEventMap>` for request events, or forgetting to instantiate the `RequestAuditSubscriber` (its wiring is a constructor side-effect, like `AuditEventSubscriber`).
**Why it happens:** The subscriber registers handlers in its constructor and the instance is then unused (`void new RequestAuditSubscriber(...)` — see `setupPolicy` in `tests/_helpers/in-memory-fakes.ts` line 28).
**How to avoid:** Create a `setupRequest(validator)` test helper mirroring `setupPolicy` that builds a `new EventDispatcher<RequestEventMap>()`, `void new RequestAuditSubscriber(auditRepo, dispatcher)`, and the `PolicyRuntimeService`. In `convex/request.ts`, wire the same way per request (handlers are stateless; dispatcher/subscriber are constructed per invocation — acceptable for synchronous in-process events).
**Warning signs:** Audit rows never appear; or request events leak into the policy audit subscriber.

### Pitfall 5: `requestType` uniqueness is application-layer, not a DB constraint

**What goes wrong:** Assuming the Convex `by_tenant_request_type` index enforces uniqueness. Convex indexes do not enforce uniqueness.
**Why it happens:** Mirrors the existing `[tenantId, name]` role pattern, which is enforced in `RoleService`, not the DB (see CONTEXT.md code_context "Application-layer uniqueness").
**How to avoid:** In `PolicyService.createPolicy`, query `by_tenant_request_type` first and throw a `RequestTypeAlreadyExistsError` if a policy already exists for `[tenantId, requestType]`. Add the error to the `policy/` barrel.
**Warning signs:** Two policies with the same `requestType` resolve ambiguously at submit time.

## Code Examples

### Resolving `requestType → policyId` (the genuinely new resolution step)

```typescript
// Source: pattern derived from convex/directory.ts handler wiring + policies index convention.
// Lives in the request module's resolution port impl OR as a new PolicyService method.
// Convex adapter side:
async resolvePolicyIdByRequestType(ctx: TenantContext, requestType: string): Promise<PolicyId | null> {
  const doc = await this.db
    .query("policies")
    .withIndex("by_tenant_request_type", q =>
      q.eq("tenantId", fromTenantId(ctx.tenantId)).eq("requestType", requestType))
    .unique();          // Convex .unique() throws if >1 — uniqueness is enforced at create, so safe
  return doc ? toPolicyId(doc._id) : null;
}
```

### In-memory `RequestEvaluation` repo (test fake — D-20)

```typescript
// Source: src/modules/audit/adapters/memory/in-memory-audit-log-repository.ts (exact shape)
export class InMemoryRequestEvaluationRepository implements RequestEvaluationRepositoryPort {
  private readonly records = new Map<RequestEvaluationId, RequestEvaluation>();
  private idCounter = 1;
  async create(
    ctx: TenantContext,
    input: CreateRequestEvaluationInput,
  ): Promise<RequestEvaluation> {
    const id = requestEvaluationId(`reqeval_${this.idCounter++}`);
    const record: RequestEvaluation = {
      id,
      tenantId: ctx.tenantId,
      createdAt: Date.now(),
      ...input,
    };
    this.records.set(id, record);
    return record;
  }
  async findById(ctx: TenantContext, id: RequestEvaluationId): Promise<RequestEvaluation | null> {
    const r = this.records.get(id);
    return r && r.tenantId === ctx.tenantId ? r : null; // tenant scoping (CON-01)
  }
  async findByTenant(ctx: TenantContext): Promise<RequestEvaluation[]> {
    return [...this.records.values()].filter((r) => r.tenantId === ctx.tenantId);
  }
}
```

### Deterministic replay verification (D-42 test)

```typescript
// Source: synthesized from runtime evaluator semantics. Proves the stored trace + immutable
// content reproduce the original decision without storing field/operator/value.
import { validateAndEvaluate } from "@/modules/runtime/index.js";

it("replay reproduces the persisted decision from content + input + trace", () => {
  const original = await service.submit(TENANT_A, { requestType: "leave", context: input });
  const version = await policyService.getActiveVersion(TENANT_A, policyId);
  const replayed = validateAndEvaluate(validator, version!.content, original.requestInput);
  expect(replayed.decision).toEqual(original.decision);
  expect(replayed.evaluationTrace).toEqual(original.trace); // {ruleId,matched}[] identical (determinism, RUN-02)
});
```

## State of the Art

| Old Approach                      | Current Approach                                                                | When Changed      | Impact                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------- |
| (none — greenfield orchestration) | Wrap pure `validateAndEvaluate` seam with `TenantContext` + persistence + audit | This phase        | First heavy consumer of the Phase 2 seam; establishes the request-runtime pattern. |
| Materialized rich trace per step  | Minimal trace `{ruleId, matched}` + deterministic replay                        | D-42 (this phase) | Smaller storage, no drift, depends on POL-03 immutability.                         |

**Deprecated/outdated:** None. No deprecated APIs in play; Convex 1.39.1, Vitest 4.1.7, Ajv 8.17.1 are current per the repo lockfile.

## Assumptions Log

| #   | Claim                                                                                                                                          | Section                     | Risk if Wrong                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Local dev Convex `policies` table has no pre-existing rows lacking `requestType` (greenfield migration).                                       | Runtime State Inventory     | If seeded rows exist, the required `requestType` field breaks reads until backfilled. LOW — planner adds a verify/backfill task.                                                              |
| A2  | Partial trace on `EvaluationError` is unavailable without modifying the evaluator; v1 stores empty trace + `errorCode`/`fieldPath`.            | Pitfall 3 / Open Q1         | If the planner instead surfaces partial trace, a small additive evaluator change is needed (CONTEXT.md says "do not modify the evaluator contract"). MEDIUM — decide explicitly at plan time. |
| A3  | Resolution + uniqueness live best in `PolicyService` (extend `createPolicy`, add `resolveByRequestType`) vs. a standalone request-module port. | Architecture / Pattern 1    | Either is valid; CONTEXT.md leaves it to discretion. LOW.                                                                                                                                     |
| A4  | A separate `EventDispatcher<RequestEventMap>` instance is correct (not reusing policy's).                                                      | Standard Stack alternatives | If reused, it couples request + policy event maps. LOW — separate instance matches established per-module ownership.                                                                          |
| A5  | Per-request construction of dispatcher + subscriber in `convex/request.ts` is acceptable (stateless, synchronous in-process).                  | Pitfall 4                   | If audit must persist across the request lifecycle differently, wiring changes. LOW — events are synchronous and complete within `submit`.                                                    |

## Open Questions (RESOLVED)

1. **Partial trace on contract violation (D-40 vs. Phase 2 evaluator contract).**
   - What we know: D-40 says persist "the partial trace up to the failure point." The evaluator builds `trace` locally and discards it when it throws `EvaluationError`; the error carries only `code` + `field`. CONTEXT.md / D-42 forbid modifying the evaluator's trace contract.
   - What's unclear: whether "partial trace" must be non-empty in v1.
   - Recommendation: v1 persists `trace: []` + `errorCode` + `fieldPath`; replay reconstructs up to the failing point from those. If non-empty partial trace is required, the planner proposes a minimal additive change (e.g. `EvaluationError` carrying accumulated trace) and flags it as a contract touch for explicit approval. **Default to empty-trace-plus-error-metadata** to respect the "no evaluator contract change" constraint.

2. **`actorId` on request events / audit.**
   - What we know: `TenantContext` carries `tenantId` now and is extensible to `actorId`/`requestId` (D-19) without signature churn. Existing audit payloads include `actorId`.
   - What's unclear: whether Phase 4 submissions have an authenticated actor to record.
   - Recommendation: thread `actorId` from `ctx` if present (`ctx.actorId`), else omit/`null`. Do not add a separate actor parameter — keep it on `TenantContext`.

## Environment Availability

| Dependency                        | Required By                                   | Available                           | Version                 | Fallback                 |
| --------------------------------- | --------------------------------------------- | ----------------------------------- | ----------------------- | ------------------------ |
| Node + TypeScript toolchain       | All code                                      | ✓                                   | repo-pinned (strict TS) | —                        |
| `convex`                          | schema migration + adapters + handlers        | ✓                                   | 1.39.1                  | —                        |
| `vitest`                          | all tests                                     | ✓                                   | 4.1.7                   | —                        |
| `ajv` (via runtime barrel)        | `validateAndEvaluate`                         | ✓                                   | 8.17.1                  | —                        |
| `eslint` + `eslint-plugin-import` | D-08 boundary zone                            | ✓                                   | installed               | —                        |
| `convex-helpers`                  | branded validators (likely unused this phase) | ✓                                   | installed               | —                        |
| Convex dev deployment             | regenerate `_generated` types for new table   | assumed available (used Phases 1–3) | —                       | Run `npm run convex:dev` |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None. All tooling present from Phases 1–3.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework          | Vitest 4.1.7                                                                                                                                                                   |
| Config file        | none discovered as `vitest.config.*` — tests run via `vitest run` resolving `@/` path alias through `tsconfig.json` paths (existing tests in `tests/**` already work this way) |
| Quick run command  | `npx vitest run tests/modules/request --reporter=dot`                                                                                                                          |
| Full suite command | `npm test` (`vitest run --reporter=dot`) / `npm run test:coverage`                                                                                                             |

> Note for planner: no standalone `vitest.config.ts` was found. Existing tests under `tests/` resolve `@/modules/...` already, so alias resolution is configured (likely in `tsconfig.json` + vitest's tsconfig-paths default). If a path-alias resolution error appears for the new `request/` test files, that is a Wave 0 config gap — but existing tests prove the mechanism works.

### Phase Requirements → Test Map

| Req ID        | Behavior                                                                                                                                                    | Test Type                        | Automated Command                                                                                    | File Exists?       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------ |
| DEC-01        | success path: submit → resolve active version → evaluate → `RequestEvaluation{status:'completed', decision, trace}` returned                                | unit (service + in-memory fakes) | `npx vitest run tests/modules/request/policy-runtime-service.test.ts -t "success" --reporter=dot`    | ❌ Wave 0          |
| DEC-01 / D-41 | resolution failure: unknown `requestType` or no active version → NO record, `ResolutionFailed` event, error thrown                                          | unit                             | `npx vitest run tests/modules/request/policy-runtime-service.test.ts -t "resolution" --reporter=dot` | ❌ Wave 0          |
| DEC-01 / D-40 | contract violation: `EvaluationError` → `RequestEvaluation{status:'failed', decision:null, errorCode, fieldPath}`, `EvaluationFailed` event, error rethrown | unit                             | `npx vitest run tests/modules/request/policy-runtime-service.test.ts -t "contract" --reporter=dot`   | ❌ Wave 0          |
| AUD-02        | by-reference audit: each path writes correct `eventType` + reference envelope; NO content (D-37)                                                            | unit                             | `npx vitest run tests/modules/request/request-audit-subscriber.test.ts --reporter=dot`               | ❌ Wave 0          |
| AUD-02 / D-42 | deterministic replay: stored `trace` + immutable `content` + `requestInput` reproduce the decision                                                          | unit                             | `npx vitest run tests/modules/request/replay.test.ts --reporter=dot`                                 | ❌ Wave 0          |
| CON-01        | tenant isolation: a `RequestEvaluation` / resolution is never visible/usable across tenants                                                                 | unit                             | `npx vitest run tests/modules/request -t "tenant" --reporter=dot`                                    | ❌ Wave 0          |
| D-39          | `createPolicy` rejects duplicate `[tenantId, requestType]`; `requestType` persisted                                                                         | unit (extends policy suite)      | `npx vitest run tests/modules/policy/policy-service.test.ts -t "requestType" --reporter=dot`         | ⚠️ extend existing |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/modules/request --reporter=dot` (plus the touched policy suite when editing `createPolicy`).
- **Per wave merge:** `npm test` (full suite — required because `createPolicy`/`Policy` changes ripple into the policy + audit suites).
- **Phase gate:** Full suite green + `npm run test:coverage` meeting the engineering-standard bar (100% on Decision Generation / Policy Engine paths per PROJECT.md Testing Constraint) before `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] `tests/modules/request/policy-runtime-service.test.ts` — covers DEC-01 (3 outcome paths: success, resolution-failure, contract-violation)
- [ ] `tests/modules/request/request-audit-subscriber.test.ts` — covers AUD-02 by-reference + D-37 no-content
- [ ] `tests/modules/request/replay.test.ts` — covers D-42 deterministic replay
- [ ] `tests/_helpers/in-memory-fakes.ts` — add `setupRequest(validator)` helper (mirrors `setupPolicy`, wires `EventDispatcher<RequestEventMap>` + `void new RequestAuditSubscriber(...)` + `InMemoryRequestEvaluationRepository`)
- [ ] Extend `tests/modules/policy/policy-service.test.ts` `createPolicy` tests for the new `requestType` arg + uniqueness (existing test at lines 35–45 will otherwise break on signature change)
- [ ] No framework install needed — Vitest already present.

## Security Domain

> `security_enforcement` absent in config → treated as enabled. Backend persistence + multi-tenant data, no auth/crypto/network surface added.

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                                                                           |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | no      | No auth introduced this phase. `actorId` (if present) arrives via `TenantContext` from upstream Convex auth — not implemented here.                                                                                        |
| V3 Session Management | no      | No sessions. Stateless service.                                                                                                                                                                                            |
| V4 Access Control     | yes     | Multi-tenant isolation (CON-01): every repo method scopes by `ctx.tenantId`; resolution + `RequestEvaluation` reads/writes filter by tenant. Enforced in-code, tested.                                                     |
| V5 Input Validation   | yes     | `requestType` is a string routing key; `EvaluationContext` is validated structurally by `validateAndEvaluate` (Ajv schema, RUN-03) before evaluation. Convex `convex/request.ts` validates arg shape via `v.*` validators. |
| V6 Cryptography       | no      | No crypto. No secrets handled. Never hand-roll any.                                                                                                                                                                        |

### Known Threat Patterns for TS modular monolith + Convex

| Pattern                                                               | STRIDE                               | Standard Mitigation                                                                                                                                 |
| --------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-tenant data leak (a tenant reads another's `RequestEvaluation`) | Information Disclosure               | Mandatory `ctx.tenantId` scoping in every repo method + tenant-prefixed indexes (D-09); tenant-isolation test (CON-01).                             |
| Code injection via policy/content                                     | Tampering / Elevation                | No `eval()` / dynamic code (Security Constraint); deterministic relational-operator evaluator only; content passes Ajv schema before evaluation.    |
| Audit tampering / content leak into ledger                            | Repudiation / Information Disclosure | By-reference audit (D-37): `auditLogs.payload` holds IDs/metadata only, never `requestInput`/`decision`/`trace`. Asserted by a no-content test.     |
| Malformed request silently coerced to a decision                      | Tampering                            | D-40: contract violations produce `status:'failed'` + rethrow, never a synthesized decision.                                                        |
| Schema-invalid policy reaching the evaluator                          | Tampering                            | RUN-03: `validateAndEvaluate` throws `PolicySchemaInvalidError` before `evaluate()`; publish gate (D-34) guarantees only `valid` content is active. |

## Sources

### Primary (HIGH confidence)

- Repo source (read this session): `src/modules/runtime/application/policy-runtime.ts`, `src/modules/runtime/application/evaluator.ts`, `src/modules/runtime/application/errors.ts`, `src/modules/runtime/domain/{evaluation-result,decision,evaluation-context}.ts`, `src/modules/runtime/index.ts` — the seam + pure-core contracts.
- `src/modules/policy/application/policy-service.ts`, `src/modules/policy/domain/{ids,policy,policy-version,policy-events}.ts`, `src/modules/policy/ports/policy-repository.port.ts`, `src/modules/policy/adapters/{convex/convex-policy-repository,convex/mappers,memory/in-memory-policy-repository}.ts`, `src/modules/policy/index.ts` — resolution primitive + entity/mapper/fake templates.
- `src/modules/audit/application/audit-event-subscriber.ts`, `src/modules/audit/{domain/audit-log,domain/ids,ports/audit-log-repository.port}.ts`, `src/modules/audit/adapters/memory/in-memory-audit-log-repository.ts`, `src/modules/audit/index.ts` — by-reference audit pattern.
- `src/shared/event-dispatcher.ts` — generic synchronous dispatcher (D-35).
- `convex/schema.ts`, `convex/directory.ts`, `convex/_branded.ts` — schema convention (D-09), thin-handler DI pattern, branded validators.
- `eslint.config.js` — `import/no-restricted-paths` module-boundary zones (D-08).
- `tests/_helpers/in-memory-fakes.ts`, `tests/modules/audit/audit-subscriber.test.ts`, `tests/modules/policy/policy-service.test.ts` — service-first testing strategy (D-20) + subscriber-as-side-effect wiring.
- `package.json` — verified versions: convex 1.39.1, vitest 4.1.7, ajv 8.17.1; scripts `test`/`test:coverage`/`lint`/`typecheck`/`convex:dev`.
- `.planning/phases/04-request-runtime/04-CONTEXT.md` — locked decisions D-38..D-42 (authoritative scope).
- `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/config.json` — constraints, concept hierarchy, `nyquist_validation:true`.

### Secondary (MEDIUM confidence)

- None — all findings grounded in repo source read this session.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — zero new packages; all versions verified against `package.json`.
- Architecture: HIGH — every pattern mirrors an existing, tested module read this session; seams confirmed by source.
- Pitfalls: HIGH — Pitfalls 1, 3, 5 derived directly from source (`createPolicy` ripple, evaluator trace-on-throw, app-layer uniqueness). Pitfall 3 / Open Q1 (partial trace) is the one genuine design decision left for the planner.

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (stable — internal codebase patterns, no fast-moving external deps)
