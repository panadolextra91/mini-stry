# Phase 4: Request Runtime - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 21 (16 new, 5 modified)
**Analogs found:** 21 / 21 (every file has a same-role, same-data-flow analog in-repo — Phase 4 is ~90% composition of existing tested shapes)

## File Classification

### New files — `src/modules/request/` module

| New File                                                                         | Role                 | Data Flow                       | Closest Analog                                                                                                                        | Match Quality                                                             |
| -------------------------------------------------------------------------------- | -------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/modules/request/domain/ids.ts`                                              | domain (branded id)  | n/a                             | `src/modules/policy/domain/ids.ts`                                                                                                    | exact                                                                     |
| `src/modules/request/domain/request-evaluation.ts`                               | model (entity)       | n/a                             | `src/modules/policy/domain/policy.ts`                                                                                                 | exact                                                                     |
| `src/modules/request/domain/request-evaluation-status.ts`                        | domain (union)       | n/a                             | `src/modules/policy/domain/policy-version-status.ts`                                                                                  | exact                                                                     |
| `src/modules/request/domain/request-events.ts`                                   | domain (event map)   | event-driven                    | `src/modules/policy/domain/policy-events.ts`                                                                                          | exact                                                                     |
| `src/modules/request/application/policy-runtime-service.ts`                      | service              | request-response + event-driven | `src/modules/policy/application/policy-service.ts` + `src/modules/runtime/application/policy-runtime.ts` (seam)                       | role-match (orchestration is new; ctor-DI + ctx-first + emit shape exact) |
| `src/modules/request/application/errors.ts`                                      | application (errors) | n/a                             | `src/modules/policy/application/errors.ts`                                                                                            | exact                                                                     |
| `src/modules/request/ports/request-evaluation-repository.port.ts`                | port                 | CRUD                            | `src/modules/audit/ports/audit-log-repository.port.ts` + `src/modules/policy/ports/policy-repository.port.ts`                         | exact                                                                     |
| `src/modules/request/adapters/convex/convex-request-evaluation-repository.ts`    | adapter              | CRUD                            | `src/modules/policy/adapters/convex/convex-policy-repository.ts` + `src/modules/audit/adapters/convex/convex-audit-log-repository.ts` | exact                                                                     |
| `src/modules/request/adapters/convex/mappers.ts`                                 | adapter (mapper)     | transform                       | `src/modules/policy/adapters/convex/mappers.ts`                                                                                       | exact                                                                     |
| `src/modules/request/adapters/memory/in-memory-request-evaluation-repository.ts` | adapter (test fake)  | CRUD                            | `src/modules/audit/adapters/memory/in-memory-audit-log-repository.ts`                                                                 | exact                                                                     |
| `src/modules/request/index.ts`                                                   | config (barrel)      | n/a                             | `src/modules/policy/index.ts`                                                                                                         | exact                                                                     |
| `src/modules/request/README.md`                                                  | doc                  | n/a                             | `src/modules/policy/README.md`                                                                                                        | exact                                                                     |

### New files — audit + convex + tests

| New File                                                    | Role                 | Data Flow        | Closest Analog                                                      | Match Quality |
| ----------------------------------------------------------- | -------------------- | ---------------- | ------------------------------------------------------------------- | ------------- |
| `src/modules/audit/application/request-audit-subscriber.ts` | service (subscriber) | event-driven     | `src/modules/audit/application/audit-event-subscriber.ts`           | exact         |
| `convex/request.ts`                                         | route (thin handler) | request-response | `convex/directory.ts`                                               | exact         |
| `tests/modules/request/policy-runtime-service.test.ts`      | test                 | n/a              | `tests/modules/policy/policy-service.test.ts`                       | exact         |
| `tests/modules/request/request-audit-subscriber.test.ts`    | test                 | n/a              | `tests/modules/audit/audit-subscriber.test.ts`                      | exact         |
| `tests/modules/request/replay.test.ts`                      | test                 | n/a              | `tests/modules/runtime/policy-runtime.test.ts` (replay synthesized) | role-match    |

### Modified files

| Modified File                                                       | Role            | Change                                                                                   | Closest Analog (in same file)                                   |
| ------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `convex/schema.ts`                                                  | config (schema) | add `requestEvaluations` table + `policies.requestType` field & index (D-38/D-39)        | existing `policyVersions` / `policies` table defs (lines 45-67) |
| `src/modules/policy/domain/policy.ts`                               | model           | add `readonly requestType: string` (D-39)                                                | self (lines 4-10)                                               |
| `src/modules/policy/application/policy-service.ts`                  | service         | extend `createPolicy` signature + `[tenantId, requestType]` uniqueness (D-39, Pitfall 5) | self `createPolicy` (lines 27-32)                               |
| `src/modules/policy/application/errors.ts`                          | application     | add `RequestTypeAlreadyExistsError`                                                      | self (lines 4-9 pattern)                                        |
| `src/modules/policy/ports/policy-repository.port.ts`                | port            | `create` input `{ name, requestType }` + `findByRequestType`                             | self (lines 5-13)                                               |
| `src/modules/policy/adapters/convex/convex-policy-repository.ts`    | adapter         | insert `requestType`; add `by_tenant_request_type` query                                 | self (lines 12-23)                                              |
| `src/modules/policy/adapters/convex/mappers.ts`                     | adapter         | map `requestType` in `toPolicyDomain`                                                    | self (lines 18-24)                                              |
| `src/modules/policy/adapters/memory/in-memory-policy-repository.ts` | adapter         | store `requestType`; add `findByRequestType`                                             | self (lines 11-22)                                              |
| `eslint.config.js`                                                  | config          | add `request` `import/no-restricted-paths` zone (D-08)                                   | existing zones (lines 28-47)                                    |
| `tests/modules/policy/policy-service.test.ts`                       | test            | update `createPolicy` calls for `requestType` + uniqueness test                          | self (lines 35-45)                                              |
| `tests/_helpers/in-memory-fakes.ts`                                 | test helper     | add `setupRequest(validator)`                                                            | self `setupPolicy` (lines 22-37)                                |

---

## Pattern Assignments

### `src/modules/request/domain/ids.ts` (branded id)

**Analog:** `src/modules/policy/domain/ids.ts` (whole file, 5 lines)

Branded-string + factory. Copy verbatim, rename:

```typescript
export type RequestEvaluationId = string & { readonly __brand: "RequestEvaluationId" };
export const requestEvaluationId = (raw: string): RequestEvaluationId => raw as RequestEvaluationId;
```

---

### `src/modules/request/domain/request-evaluation-status.ts` (union)

**Analog:** `src/modules/policy/domain/policy-version-status.ts` (line 1)

Small string union, one line:

```typescript
export type RequestEvaluationStatus = "completed" | "failed";
```

---

### `src/modules/request/domain/request-evaluation.ts` (entity)

**Analog:** `src/modules/policy/domain/policy.ts` (lines 1-10) — plain `readonly` interface (D-13), IDs imported from `./ids.js`, `TenantId` from directory barrel.

**Imports pattern** (mirror `policy.ts` lines 1-2, add runtime barrel for `Decision`/`TraceEntry`/`EvaluationContext`/`EvaluationErrorCode`, policy barrel for `PolicyVersionId`):

```typescript
import type { TenantId } from "@/modules/directory/index.js";
import type { PolicyVersionId } from "@/modules/policy/index.js"; // barrel (D-08)
import type {
  Decision,
  TraceEntry,
  EvaluationContext,
  EvaluationErrorCode,
} from "@/modules/runtime/index.js"; // barrel (D-08)
import type { RequestEvaluationId } from "./ids.js";
import type { RequestEvaluationStatus } from "./request-evaluation-status.js";
```

**Entity shape** (RESEARCH Pattern 2; matches `Decision | null` per D-40, non-null `policyVersionId` per D-41, `{ruleId,matched}[]` per D-42):

```typescript
export interface RequestEvaluation {
  readonly id: RequestEvaluationId;
  readonly tenantId: TenantId;
  readonly requestType: string;
  readonly requestInput: EvaluationContext;
  readonly policyVersionId: PolicyVersionId; // non-null always (D-41)
  readonly decision: Decision | null; // null on failure (D-40)
  readonly trace: readonly TraceEntry[]; // {ruleId, matched} only (D-42)
  readonly status: RequestEvaluationStatus;
  readonly errorCode: EvaluationErrorCode | null;
  readonly fieldPath: string | null;
  readonly createdAt: number; // epoch ms
}
```

---

### `src/modules/request/domain/request-events.ts` (event map)

**Analog:** `src/modules/policy/domain/policy-events.ts` (lines 1-40) — one `interface` per event, then a `*EventMap` type alias keyed by event name.

**Imports + event-map pattern** (mirror lines 1-2 + 36-40):

```typescript
import type { TenantId } from "@/modules/directory/index.js";
import type { RequestEvaluationId } from "./ids.js";
import type { EvaluationErrorCode } from "@/modules/runtime/index.js";

export interface RequestEvaluatedEvent {
  readonly tenantId: TenantId;
  readonly evaluationRecordId: RequestEvaluationId;
  readonly timestamp: number;
}
export interface EvaluationFailedEvent {
  readonly tenantId: TenantId;
  readonly evaluationRecordId: RequestEvaluationId;
  readonly errorCode: EvaluationErrorCode;
  readonly timestamp: number;
}
export interface ResolutionFailedEvent {
  readonly tenantId: TenantId;
  readonly requestType: string;
  readonly reason: string; // "POLICY_NOT_FOUND" | "NO_ACTIVE_VERSION"
  readonly timestamp: number; // NO evaluationRecordId — no record exists (D-41)
}

export type RequestEventMap = {
  RequestEvaluated: RequestEvaluatedEvent;
  EvaluationFailed: EvaluationFailedEvent;
  ResolutionFailed: ResolutionFailedEvent;
};
```

---

### `src/modules/request/application/errors.ts` (errors)

**Analog:** `src/modules/policy/application/errors.ts` (lines 4-9 — `extends Error`, `public readonly` ctor field, `this.name` set).

```typescript
export class PolicyNotFoundForRequestType extends Error {
  constructor(public readonly requestType: string) {
    super(`No policy found for request type "${requestType}" in this tenant`);
    this.name = "PolicyNotFoundForRequestType";
  }
}
export class NoActivePolicyError extends Error {
  constructor(public readonly requestType: string) {
    super(`Policy for request type "${requestType}" has no active published version`);
    this.name = "NoActivePolicyError";
  }
}
```

---

### `src/modules/request/ports/request-evaluation-repository.port.ts` (port, CRUD)

**Analog:** `src/modules/audit/ports/audit-log-repository.port.ts` (lines 1-12) — `CreateXInput` interface + port interface, `ctx: TenantContext` first arg on every method.

**Pattern** (note: `create` input omits `id`/`tenantId`/`createdAt` — those are assigned by the adapter, exactly like `CreateAuditLogInput`):

```typescript
import type { RequestEvaluation } from "../domain/request-evaluation.js";
import type { RequestEvaluationId } from "../domain/ids.js";
import type { TenantContext } from "@/modules/directory/index.js";
import type {
  Decision,
  TraceEntry,
  EvaluationContext,
  EvaluationErrorCode,
} from "@/modules/runtime/index.js";
import type { PolicyVersionId } from "@/modules/policy/index.js";

export interface CreateRequestEvaluationInput {
  readonly requestType: string;
  readonly requestInput: EvaluationContext;
  readonly policyVersionId: PolicyVersionId;
  readonly decision: Decision | null;
  readonly trace: readonly TraceEntry[];
  readonly status: "completed" | "failed";
  readonly errorCode: EvaluationErrorCode | null;
  readonly fieldPath: string | null;
}

export interface RequestEvaluationRepositoryPort {
  create(ctx: TenantContext, input: CreateRequestEvaluationInput): Promise<RequestEvaluation>;
  findById(ctx: TenantContext, id: RequestEvaluationId): Promise<RequestEvaluation | null>;
  findByTenant(ctx: TenantContext): Promise<RequestEvaluation[]>;
}
```

---

### `src/modules/request/adapters/memory/in-memory-request-evaluation-repository.ts` (test fake, CRUD)

**Analog:** `src/modules/audit/adapters/memory/in-memory-audit-log-repository.ts` (lines 6-32) — `Map` keyed by id, `idCounter`, `ctx.tenantId` stamped on create, tenant-scoped reads.

**Core pattern** (mirror audit fake `create` lines 10-21 + add the tenant-scoped `findById` from `in-memory-policy-repository.ts` lines 24-29):

```typescript
import { requestEvaluationId as buildId, type RequestEvaluationId } from "../../domain/ids.js";

export class InMemoryRequestEvaluationRepository implements RequestEvaluationRepositoryPort {
  private readonly records = new Map<RequestEvaluationId, RequestEvaluation>();
  private idCounter = 1;

  async create(
    ctx: TenantContext,
    input: CreateRequestEvaluationInput,
  ): Promise<RequestEvaluation> {
    const id = buildId(`reqeval_${this.idCounter++}`);
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
    if (!r) return null;
    if (r.tenantId !== ctx.tenantId) return null; // tenant scoping (CON-01) — mirrors policy fake lines 26-27
    return r;
  }
  async findByTenant(ctx: TenantContext): Promise<RequestEvaluation[]> {
    return [...this.records.values()].filter((r) => r.tenantId === ctx.tenantId);
  }
}
```

---

### `src/modules/request/adapters/convex/mappers.ts` (mapper, transform)

**Analog:** `src/modules/policy/adapters/convex/mappers.ts` (lines 1-42) — `to*Id`/`from*Id` pair + `to*Domain`. Reuse `toTenantId` from directory adapter mappers and `toPolicyVersionId` from policy adapter mappers.

**ID + entity mapper pattern** (mirror policy mappers lines 11-12, 18-24; note `decision`/`trace` are stored as `v.any()`-shaped docs and cast on read like `policyVersions.content`):

```typescript
import { requestEvaluationId as buildId, type RequestEvaluationId } from "../../domain/ids.js";
import type { RequestEvaluation } from "../../domain/request-evaluation.js";
import type { RequestEvaluationStatus } from "../../domain/request-evaluation-status.js";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel.js";
import { toTenantId } from "@/modules/directory/adapters/convex/mappers.js";
import { toPolicyVersionId } from "@/modules/policy/adapters/convex/mappers.js";
import type {
  Decision,
  TraceEntry,
  EvaluationContext,
  EvaluationErrorCode,
} from "@/modules/runtime/index.js";

export const toRequestEvaluationId = (raw: Id<"requestEvaluations">): RequestEvaluationId =>
  buildId(raw);
export const fromRequestEvaluationId = (brand: RequestEvaluationId): Id<"requestEvaluations"> =>
  brand as string as Id<"requestEvaluations">;

export const toRequestEvaluationDomain = (doc: Doc<"requestEvaluations">): RequestEvaluation => ({
  id: toRequestEvaluationId(doc._id),
  tenantId: toTenantId(doc.tenantId),
  requestType: doc.requestType,
  requestInput: doc.requestInput as EvaluationContext,
  policyVersionId: toPolicyVersionId(doc.policyVersionId),
  decision: doc.decision as Decision | null,
  trace: doc.trace as readonly TraceEntry[],
  status: doc.status as RequestEvaluationStatus,
  errorCode: doc.errorCode as EvaluationErrorCode | null,
  fieldPath: doc.fieldPath,
  createdAt: doc.createdAt,
});
```

> NOTE: deep-importing `@/modules/policy/adapters/convex/mappers.js` and `@/modules/directory/adapters/convex/mappers.js` is the established convention for adapters (policy mappers line 6 already deep-imports directory mappers). The D-08 zone only blocks `domain/application/adapters` from _other module application code_; adapter→adapter wiring is permitted and already used.

---

### `src/modules/request/adapters/convex/convex-request-evaluation-repository.ts` (adapter, CRUD)

**Analog:** `src/modules/policy/adapters/convex/convex-policy-repository.ts` (lines 9-30) + `src/modules/audit/adapters/convex/convex-audit-log-repository.ts` (lines 8-31).

**DB-handle ctor + insert + tenant-checked get** (mirror policy repo lines 9-23):

```typescript
import type { MutationCtx, QueryCtx } from "../../../../../convex/_generated/server.js";
import { fromTenantId } from "@/modules/directory/adapters/convex/mappers.js";
import { fromPolicyVersionId } from "@/modules/policy/adapters/convex/mappers.js";
import { toRequestEvaluationDomain, fromRequestEvaluationId } from "./mappers.js";

export class ConvexRequestEvaluationRepository implements RequestEvaluationRepositoryPort {
  constructor(private readonly db: MutationCtx["db"] | QueryCtx["db"]) {}

  async create(
    ctx: TenantContext,
    input: CreateRequestEvaluationInput,
  ): Promise<RequestEvaluation> {
    if (!("insert" in this.db)) throw new Error("Mutations require MutationCtx");
    const id = await this.db.insert("requestEvaluations", {
      tenantId: fromTenantId(ctx.tenantId),
      requestType: input.requestType,
      requestInput: input.requestInput,
      policyVersionId: fromPolicyVersionId(input.policyVersionId),
      decision: input.decision,
      trace: input.trace,
      status: input.status,
      errorCode: input.errorCode,
      fieldPath: input.fieldPath,
      createdAt: Date.now(),
    });
    const doc = await this.db.get(id);
    if (!doc) throw new Error("RequestEvaluation creation failed");
    return toRequestEvaluationDomain(doc);
  }
  // findById: mirror policy repo lines 25-30 (get + tenant check).
  // findByTenant: mirror audit repo lines 24-31 (.withIndex("by_tenant_created", q => q.eq("tenantId", ...)).collect()).
}
```

---

### `src/modules/request/index.ts` (barrel)

**Analog:** `src/modules/policy/index.ts` (lines 1-40) — grouped exports: domain entities, IDs (type + factory), status types, events, service, errors, ports, re-export `EventDispatcher` from shared, Convex adapters + mappers.

Export everything cross-module consumers + `convex/request.ts` + tests need: `RequestEvaluation`, `RequestEvaluationId`/`requestEvaluationId`, `RequestEvaluationStatus`, `RequestEventMap` + event types, `PolicyRuntimeService`, `PolicyNotFoundForRequestType`/`NoActivePolicyError`, `RequestEvaluationRepositoryPort`/`CreateRequestEvaluationInput`, `EventDispatcher` (re-export from `@/shared/event-dispatcher.js`, mirror policy index line 35), `ConvexRequestEvaluationRepository`, mapper fns, `InMemoryRequestEvaluationRepository`.

---

### `src/modules/request/application/policy-runtime-service.ts` (service — the deliverable)

**Analog:** `src/modules/policy/application/policy-service.ts` for ctor-DI + `ctx`-first + `dispatcher.emit` shape (lines 19-32, 69-77); `src/modules/runtime/application/policy-runtime.ts` for the wrapped seam (lines 21-32, whose header at lines 18-19 explicitly names this service).

**Ctor-DI pattern** (mirror `PolicyService` lines 19-25 — all deps `private readonly`, no ambient resolution):

```typescript
import type { TenantContext } from "@/modules/directory/index.js";
import { validateAndEvaluate, EvaluationError, type SchemaValidatorPort, type EvaluationContext } from "@/modules/runtime/index.js";
import { PolicyService, type PolicyId } from "@/modules/policy/index.js";
import type { EventDispatcher } from "@/shared/event-dispatcher.js";
import type { RequestEventMap } from "../domain/request-events.js";
import type { RequestEvaluation } from "../domain/request-evaluation.js";
import type { RequestEvaluationRepositoryPort } from "../ports/request-evaluation-repository.port.js";
import { PolicyNotFoundForRequestType, NoActivePolicyError } from "./errors.js";

export class PolicyRuntimeService {
  constructor(
    private readonly policyService: PolicyService,                  // reuse getActiveVersion + resolveByRequestType
    private readonly validator: SchemaValidatorPort,
    private readonly evalRepo: RequestEvaluationRepositoryPort,
    private readonly dispatcher: EventDispatcher<RequestEventMap>,
  ) {}
```

**`submit(ctx, input)` — three outcome paths.** RESEARCH Pattern 1 (lines 241-289) is the authoritative skeleton. Critical contract points to copy:

- `ctx: TenantContext` is the **first** parameter (D-19, mirrors every `PolicyService` method).
- **(1) RESOLVE** — resolve `requestType → policyId` (see Pitfall 5 note below on where this lives), then `await this.policyService.getActiveVersion(ctx, policyId)` (the primitive at `policy-service.ts` lines 223-232). On either miss → emit `ResolutionFailed`, **no record** (D-41), throw `PolicyNotFoundForRequestType` / `NoActivePolicyError`.
- **(2) EVALUATE** — `validateAndEvaluate(this.validator, version.content, input.context)` (default to re-validation, RUN-03 defense-in-depth, per CONTEXT discretion).
- **(3a) SUCCESS** — `evalRepo.create(ctx, { status:"completed", decision: result.decision, trace: result.evaluationTrace, errorCode:null, fieldPath:null, ... })`, then `dispatcher.emit("RequestEvaluated", { tenantId: ctx.tenantId, evaluationRecordId: record.id, timestamp: Date.now() })` — emit shape mirrors `PolicyService` lines 69-77. Return the record.
- **(3b) CONTRACT VIOLATION** — `catch (err)`; `if (err instanceof EvaluationError)` → `evalRepo.create(ctx, { status:"failed", decision:null, errorCode: err.code, fieldPath: err.field, trace: [], ... })`, emit `EvaluationFailed`, then **`throw err`** (D-40 rethrow). Non-`EvaluationError` (e.g. `PolicySchemaInvalidError`) → `throw err` with **no** `failed` record (anti-pattern guard, D-40).

> **Pitfall 3 (partial trace) — DEFAULT for v1:** persist `trace: []` on the `failed` record. The pure evaluator (`src/modules/runtime/application/evaluator.ts` lines 12-22) builds `trace` as a local array and discards it when `EvaluationError` throws; `EvaluationError` (`runtime/application/errors.ts` lines 17-26) carries only `code` + `field`, not partial trace. Honoring "no evaluator-contract change" (D-42) means empty-trace + `errorCode`/`fieldPath` is the v1 store; replay reconstructs up to the failing rule. Planner must state this explicitly; a non-empty partial trace would require an additive evaluator change and explicit approval.

> **Pitfall 5 (resolution + uniqueness):** RESEARCH A3 recommends extending `PolicyService` (add a `resolveByRequestType`/`findByRequestType` method + enforce `[tenantId, requestType]` uniqueness inside `createPolicy`) over a standalone request-module port. The Convex resolution query (`by_tenant_request_type` index + `.unique()`) lives in `convex-policy-repository.ts`; see RESEARCH Code Examples lines 457-464. `.unique()` is safe because uniqueness is enforced at create time, not by the index.

---

### `src/modules/audit/application/request-audit-subscriber.ts` (subscriber, event-driven)

**Analog:** `src/modules/audit/application/audit-event-subscriber.ts` (lines 15-63) — class whose **constructor registers `dispatcher.on(...)` handlers** (side-effect wiring); each handler builds `ctx = { tenantId: event.tenantId }` and calls `auditRepo.create(ctx, { eventType, payload })` with **reference-only** payload (D-37).

**Pattern** (mirror lines 15-33; `eventType` strings follow `<aggregate>.<action>`):

```typescript
import type { AuditLogRepositoryPort } from "../ports/audit-log-repository.port.js";
import type { EventDispatcher } from "@/shared/event-dispatcher.js";
import type { RequestEventMap } from "@/modules/request/index.js"; // barrel (D-08)
import type { TenantContext } from "@/modules/directory/index.js";

export class RequestAuditSubscriber {
  constructor(
    private readonly auditRepo: AuditLogRepositoryPort,
    dispatcher: EventDispatcher<RequestEventMap>,
  ) {
    dispatcher.on("RequestEvaluated", async (e) => {
      const ctx: TenantContext = { tenantId: e.tenantId };
      await this.auditRepo.create(ctx, {
        eventType: "request.evaluated",
        payload: { tenantId: e.tenantId, evaluationRecordId: e.evaluationRecordId }, // by-reference only (D-37)
      });
    });
    dispatcher.on("EvaluationFailed", async (e) => {
      const ctx: TenantContext = { tenantId: e.tenantId };
      await this.auditRepo.create(ctx, {
        eventType: "request.evaluation_failed",
        payload: {
          tenantId: e.tenantId,
          evaluationRecordId: e.evaluationRecordId,
          errorCode: e.errorCode,
        },
      });
    });
    dispatcher.on("ResolutionFailed", async (e) => {
      const ctx: TenantContext = { tenantId: e.tenantId };
      await this.auditRepo.create(ctx, {
        eventType: "request.resolution_failed",
        payload: { tenantId: e.tenantId, requestType: e.requestType, reason: e.reason }, // NO evaluationRecordId (D-41)
      });
    });
  }
}
```

> Add `RequestAuditSubscriber` to `src/modules/audit/index.ts` (mirror the existing `AuditEventSubscriber` export at line 7). The audit module already deep-references the policy barrel for its event map (`audit-event-subscriber.ts` line 2) — referencing `@/modules/request/index.js` is the same permitted barrel pattern.

---

### `convex/request.ts` (thin handler, request-response)

**Analog:** `convex/directory.ts` (lines 1-32) — leading HARD-RULE comment, `mutation`/`query` from `./_generated/server.js`, `v.*` arg validators, handler that (1) builds repos/services from `ctx.db`, (2) builds `tCtx = tenantContext(tenantId(args.tenantId))`, (3) calls the service, (4) returns. **No orchestration logic** (RESEARCH anti-pattern).

**Pattern** (mirror `createRole` lines 24-32; wire the two `EventDispatcher` + subscriber per-invocation per Pitfall 4 / RESEARCH A5):

```typescript
import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import { tenantContext, tenantId } from "../src/modules/directory/index.js";
import {
  PolicyRuntimeService,
  EventDispatcher,
  ConvexRequestEvaluationRepository,
  requestEvaluationId,
} from "../src/modules/request/index.js";
import type { RequestEventMap } from "../src/modules/request/index.js";
import {
  PolicyService,
  ConvexPolicyRepository,
  ConvexPolicyVersionRepository,
} from "../src/modules/policy/index.js";
import { AjvSchemaValidator } from "../src/modules/runtime/index.js";
import { RequestAuditSubscriber, ConvexAuditLogRepository } from "../src/modules/audit/index.js";

export const submitRequest = mutation({
  args: { tenantId: v.string(), requestType: v.string(), context: v.any() },
  handler: async (ctx, args) => {
    const dispatcher = new EventDispatcher<RequestEventMap>();
    void new RequestAuditSubscriber(new ConvexAuditLogRepository(ctx.db), dispatcher);
    const policyService = new PolicyService(
      new ConvexPolicyRepository(ctx.db),
      new ConvexPolicyVersionRepository(ctx.db),
      new AjvSchemaValidator(),
      new EventDispatcher(), // policy's own dispatcher (separate map — RESEARCH A4)
    );
    const service = new PolicyRuntimeService(
      policyService,
      new AjvSchemaValidator(),
      new ConvexRequestEvaluationRepository(ctx.db),
      dispatcher,
    );
    const tCtx = tenantContext(tenantId(args.tenantId));
    return service.submit(tCtx, { requestType: args.requestType, context: args.context });
  },
});
```

> `submitRequest` returns the `RequestEvaluation`; on contract violation `submit` rethrows (D-40) and Convex surfaces the error to the caller. Add a `getRequestEvaluation` query mirroring `getRole` (`directory.ts` lines 34-42) using `findById`.

---

## Shared Patterns

### Tenant Context (first parameter — D-19)

**Source:** `src/modules/directory/application/tenant-context.ts` (lines 8-12)
**Apply to:** `PolicyRuntimeService.submit`, every repo-port method, every `convex/request.ts` handler.

```typescript
export interface TenantContext {
  readonly tenantId: TenantId;
}
export const tenantContext = (tenantId: TenantId): TenantContext => ({ tenantId });
```

Every method takes `ctx: TenantContext` first; reads/writes scope by `ctx.tenantId`. Never resolve tenant ambiently.

### Synchronous Event Dispatch (D-35)

**Source:** `src/shared/event-dispatcher.ts` (lines 9-31) — generic, sequential `await` fan-out.
**Apply to:** `PolicyRuntimeService` (a `new EventDispatcher<RequestEventMap>()` — a **separate** instance from policy's, RESEARCH A4) + `RequestAuditSubscriber`.
Wiring is a constructor side-effect: `void new RequestAuditSubscriber(auditRepo, dispatcher)` (mirror `setupPolicy` line 28 / Pitfall 4).

### By-Reference Audit (D-37)

**Source:** `src/modules/audit/application/audit-event-subscriber.ts` (lines 20-33) + `src/modules/audit/domain/audit-log.ts` (lines 6-13, `payload: unknown`, open `eventType` string).
**Apply to:** all three `RequestAuditSubscriber` handlers. Payload holds IDs/metadata only — **never** `requestInput` / `decision` / `trace` content. `requestEvaluations` is the operational store; `auditLogs` is the reference ledger.

### Branded-ID + Mapper Pair

**Source:** `src/modules/policy/adapters/convex/mappers.ts` (lines 11-15) — `to*Id(raw): Brand => build(raw)` / `from*Id(brand): Id => brand as string as Id`.
**Apply to:** `RequestEvaluationId` mappers; reuse `fromTenantId`/`toTenantId` (`directory/adapters/convex/mappers.ts` lines 8-9) and `fromPolicyVersionId`/`toPolicyVersionId` (`policy/adapters/convex/mappers.ts` lines 14-15).

### In-Memory Fake setup helper (D-20)

**Source:** `tests/_helpers/in-memory-fakes.ts` `setupPolicy` (lines 22-37).
**Apply to:** new `setupRequest(validator)` — builds `InMemoryRequestEvaluationRepository`, `new EventDispatcher<RequestEventMap>()`, `void new RequestAuditSubscriber(auditRepo, dispatcher)`, and `new PolicyRuntimeService(policyService, validator, evalRepo, dispatcher)`. Likely composes `setupPolicy` to obtain a wired `policyService`. Returns `{ service, evalRepo, auditRepo, dispatcher, policyService }`.

### ESLint Module Boundary Zone (D-08)

**Source:** `eslint.config.js` (lines 34-37, the `policy` zone).
**Apply to:** add a `request` zone, copy-paste with the module name swapped:

```javascript
{
  target: "./src/modules/!(request)/**/*",
  from: "./src/modules/request/{domain,application,adapters}/**/*",
  message: "Cross-module deep imports forbidden. Import from '@/modules/request' (barrel) instead — Module Boundary Rule (D-08)."
},
```

The generic `domain↛application/adapters`, `application↛adapters`, and two `convex/` zones (lines 48-68) already cover the new files via `src/modules/*` globs.

### Convex Schema Extension (D-09 tenant-prefixed indexes)

**Source:** `convex/schema.ts` (lines 45-67 — `policies` + `policyVersions` table defs).
**Apply to:** (a) add `requestType: v.string()` to `policies` + `.index("by_tenant_request_type", ["tenantId", "requestType"])`; (b) add the `requestEvaluations` table per RESEARCH Pattern 4 (lines 365-378). `requestInput`/`decision` use `v.any()` like `policyVersions.content` (line 56); `trace` is `v.array(v.object({ ruleId: v.string(), matched: v.boolean() }))`. Indexes: `by_tenant_created` + `by_tenant_request_type`. After editing, run `npm run convex:dev` to regenerate `_generated` types (RESEARCH Runtime State Inventory).

---

## Modified-File Impact (Phase-3-touching — run GitNexus impact first per CLAUDE.md)

`policies.requestType` (D-39) ripples across the `policy/` module. Per CLAUDE.md, run `gitnexus_impact({target: "createPolicy", direction: "upstream"})` and `gitnexus_impact({target: "Policy", direction: "upstream"})` **before editing**. d=1 dependents to update together (RESEARCH Pitfall 1):

| File                                                                | Change                                                                                                                                                           | Anchor (line)                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `src/modules/policy/domain/policy.ts`                               | add `readonly requestType: string`                                                                                                                               | line 7 area                   |
| `src/modules/policy/ports/policy-repository.port.ts`                | `create` input → `{ name; requestType }`; add `findByRequestType(ctx, requestType): Promise<Policy \| null>`                                                     | lines 5-13                    |
| `src/modules/policy/adapters/convex/convex-policy-repository.ts`    | insert `requestType` (line 16 area); add `findByRequestType` via `by_tenant_request_type` + `.unique()`                                                          | lines 12-23                   |
| `src/modules/policy/adapters/convex/mappers.ts`                     | map `requestType: doc.requestType` in `toPolicyDomain`                                                                                                           | lines 18-24                   |
| `src/modules/policy/adapters/memory/in-memory-policy-repository.ts` | store `requestType` (line 16 area); add `findByRequestType` (filter by tenant + requestType)                                                                     | lines 11-22                   |
| `src/modules/policy/application/policy-service.ts`                  | `createPolicy(ctx, { name, requestType })` + `[tenantId, requestType]` uniqueness check (query `findByRequestType` first, throw `RequestTypeAlreadyExistsError`) | lines 27-32                   |
| `src/modules/policy/application/errors.ts`                          | add `RequestTypeAlreadyExistsError` (mirror `DraftAlreadyExistsError` lines 57-64)                                                                               | lines 57-64                   |
| `src/modules/policy/index.ts`                                       | export `RequestTypeAlreadyExistsError`; export `findByRequestType` type if a new port type emerges                                                               | lines 18-26                   |
| `tests/modules/policy/policy-service.test.ts`                       | every `createPolicy(TENANT, { name })` call → add `requestType`; add uniqueness test                                                                             | lines 38, 50 + all call sites |

**Warning sign:** TS errors in `schema.ts` validator, `mappers.ts`, in-memory fake, or `policy-service.test.ts` after the field is added = the ripple is incomplete.

---

## No Analog Found

None. Every Phase 4 file maps to an existing same-role, same-data-flow analog in the repo (Phases 1-3 established all required shapes). The only genuinely novel logic is the three-path control flow inside `PolicyRuntimeService.submit` and the `requestType` resolution step — both synthesized from existing seams (`validateAndEvaluate`, `getActiveVersion`) per RESEARCH Pattern 1.

## Metadata

**Analog search scope:** `src/modules/{policy,audit,runtime,directory}/**`, `src/shared/`, `convex/`, `tests/`
**Files scanned:** 28 read in full or targeted; module tree fully enumerated.
**Pattern extraction date:** 2026-06-03
