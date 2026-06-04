# Roadmap: Mini-stry (Policy Runtime Platform)

## Overview

Mini-stry's development journey is structured around the runtime formula:

```
Policy + EvaluationContext  →  Decision  →  Decision Consumers
```

**Phase 1** establishes the multi-tenant directory primitives (Tenants, Users, dynamic Roles, domain skeletons). **Phase 2** implements the Policy Runtime Core — defines the `EvaluationContext` interface, structured JSON rule schemas, native JSON Schema validation (a prerequisite to evaluation), the safe Pure-TS evaluator, and base Decision emission. **Phase 3** wraps the runtime in a Policy Lifecycle — draft, publish, immutability, rollback, audit. **Phase 4** introduces the request submission runtime and decision-path tracing. **Phase 5** ships the first reference Decision Consumer — sequential supervisor approval routing — to demonstrate the runtime's downstream pluggability. **Phase 6** delivers a premium Monaco-based React admin portal.

The runtime stays domain-neutral. Approval routing is one consumer among many; it is not the runtime's purpose.

## Phases

- [x] **Phase 1: Core Platform Foundations** - Establish modular directory structure, domain entity interfaces, Convex schemas (Tenants, Users, dynamic ID-based Roles, initial skeletons for Policy, PolicyVersion, AuditLog), and decoupled Application Services (RoleService and UserService) verified with Vitest.
- [x] **Phase 2: Policy Runtime Core** - Define the `EvaluationContext` interface, structured JSON rule schemas, native JSON Schema validation (prerequisite to evaluation), the safe relational evaluator (Pure TS, no `eval()`), and base Decision emission.
- [x] **Phase 3: Policy Lifecycle** - Wrap the runtime in a draft → publish → rollback lifecycle with immutable versioning. Reuse the runtime's JSON Schema validator at lifecycle boundaries.
- [x] **Phase 4: Request Runtime** - Orchestrate evaluation payloads submitted as EvaluationContexts to active policies, persist decision records, and trace step-by-step execution paths.
- [ ] **Phase 5: Approval Routing (Reference Decision Consumer)** - Ship the first reference Decision Consumer. Resolve supervisor reporting lines (`managerId`) and role registries to generate sequential, multi-stage approval task chains from Request-Approval Decisions.
- [ ] **Phase 6: Admin Portal & UI Dashboard** - Premium React portal featuring a Monaco-based JSON editor with autocompletion, real-time validation, request logs, and personal approval dashboard.

---

## Phase Details

### Phase 1: Core Platform Foundations

**Goal**: Bootstrap directory structures, database schemas, decoupled core domain entities, and separated application-layer registries (RoleService and UserService) to support dynamic ID-based role reference structures.
**Depends on**: Nothing (first phase)
**Requirements**: CON-01, CON-02, CON-03, CON-04, POL-05, POL-06, AUD-03
**Success Criteria**:

1. Base modular directory structure established under modular monorepo and Hexagonal Architecture rules.
2. Convex schemas define isolation index structures for Tenants, Users, dynamic Roles, and initial skeletons.
3. Stable user-role references resolved via unique database ID (`roleId`), eliminating renaming failures.
4. RoleService and UserService decoupled in application layer, enforcing Single Responsibility.
5. Skeletons for `PolicyEntity`, `PolicyVersionEntity`, and `AuditLogEntity` defined as first-class domain citizens.

**Plans**: 4 plans

- [x] 01-01: Bootstrap repository toolchain — package.json + tsconfig + vitest.config + ESLint flat config (with no-restricted-paths zones enforcing D-08) + Prettier + ARCHITECTURE.md + initial convex/ stub (Wave 1).
- [x] 01-02: Build the Pure-TS domain layer — branded IDs, entity interfaces, TenantContext (D-19), repository ports, custom error classes, curated module barrels + READMEs for directory/policy/audit (Wave 2).
- [x] 01-03: Define convex/schema.ts with six tables and tenant-prefixed composite indexes (CON-01..04, POL-05/06, AUD-03) plus Convex Auth field reservation; produce convex/\_generated/ via codegen (Wave 2).
- [x] 01-04: Implement RoleService + UserService + Convex adapters (mappers, repositories) + in-memory fakes + Vitest suite (90% coverage on tenant isolation, role uniqueness, manager cycle prevention); BLOCKING task pushes schema to live Convex deployment + runs gitnexus analyze (Wave 3).

### Phase 2: Policy Runtime Core

**Goal**: Implement the pure-function runtime: `Policy + EvaluationContext → Decision`. Define the `EvaluationContext` interface, structured JSON rule schemas, native JSON Schema validation (as a prerequisite to evaluation), the safe relational evaluator (Pure TS, no `eval()`), and base Decision emission.
**Depends on**: Phase 1
**Requirements**: CTX-01, CTX-02, RUN-01, RUN-02, RUN-03, DEC-02
**Success Criteria**:

1. `EvaluationContext` defined as a domain-neutral TS interface with no hardcoded domain fields.
2. JSON rule model supports relational operators (e.g. eq, gt, lt, contains) and variable lookups against the EvaluationContext.
3. JSON Schema validation rejects malformed policies before they reach the evaluator. The evaluator can never run on an invalid policy.
4. Condition evaluation engine runs in Pure TypeScript, completely banning dynamic code execution or `eval()`.
5. Base decision emitter accurately produces structured Decisions (Auto-Approve, Auto-Reject, Request-Approval). The Decision type is open to future outcomes.
6. 100% test coverage on JSON Schema validation, condition evaluation, and Decision emission.

**Plans**: 3 plans

**Wave 1**

- [x] 02-01: Define the `EvaluationContext` interface and structured JSON policy rule schemas; ship the JSON Schema validator as the runtime's first checkpoint.

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 02-02: Implement deterministic Pure-TS JSON Policy Condition Evaluator with relational logic over the EvaluationContext.

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 02-03: Implement base Decision emitter yielding structured Decisions from rule evaluation results.

**Cross-cutting constraints:**

- Hexagonal: `SchemaValidatorPort` (`runtime/ports/`) + Ajv adapter (`runtime/adapters/ajv/`); Ajv `ErrorObject` never crosses the adapter boundary (D-22)
- JSON Schema document at `src/modules/runtime/schema/policy-content.schema.json` is the canonical source of truth (D-23) — runtime, lifecycle (Phase 3), and Monaco (Phase 6) all consume the same artifact
- Decision is a discriminated union owned by `runtime/` (D-29, D-31); no standalone `decision/` module
- 100% test coverage on `src/modules/runtime/**/*.ts` (engineering.md + per-folder vitest threshold from 02-01)
- No `eval()`, no `any`, no Convex, no `TenantContext` in Phase 2 runtime (PROJECT.md constraints)

### Phase 3: Policy Lifecycle

**Goal**: Wrap the runtime in an administrative lifecycle — draft, publish (immutable), rollback — and persist policy publication audit logs. Lifecycle operations reuse the runtime's JSON Schema validator at their boundaries.
**Depends on**: Phase 2
**Requirements**: POL-01, POL-02, POL-03, POL-04, AUD-01
**Success Criteria**:

1. Draft modifications invoke the runtime-layer JSON Schema validator before save.
2. Modifying a published policy throws an explicit error, guaranteeing absolute version immutability.
3. Active-version tracking allows seamless updates and instant rollbacks to arbitrary version IDs.
4. Policy publication/rollback events logged to immutable audit records.

**Plans**: 2 plans

**Wave 1**

- [x] 03-01: Implement draft creation calling the runtime schema validator, immutable publishing logic, optimistic concurrency, and domain event infrastructure (EventDispatcher).

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 03-02: Implement rollback-as-forward-clone, active-version selector, audit event subscribers, and Convex lifecycle persistence adapters.

**Cross-cutting constraints:**

- Lifecycle reuses `SchemaValidatorPort` from `runtime/` — no separate validator (RUN-03, D-34)
- Domain events dispatched synchronously via `EventDispatcher` — no external messaging (D-35)
- Audit records store by-reference: IDs + metadata only, never content (D-37)
- Optimistic concurrency on drafts via `revision` field (D-36)
- Version numbers strictly monotonic — rollback creates forward clone (D-33)

### Phase 4: Request Runtime

**Goal**: Orchestrate request payload submissions as EvaluationContexts, run them through the Policy Runtime against active policy versions, and persist decision-path traces.
**Depends on**: Phase 3
**Requirements**: DEC-01, AUD-02
**Success Criteria**:

1. PolicyRuntimeService successfully runs submitted EvaluationContexts against active JSON rules.
2. Records step-by-step evaluation results, storing the precise decision path mapped during the run.

**Plans**: 2 plans

- [ ] 04-01-PLAN.md — request/ module + PolicyRuntimeService.submit (3 outcome paths) + policies.requestType ripple + requestEvaluations table (DEC-01)
- [ ] 04-02-PLAN.md — RequestAuditSubscriber (by-reference request.\* audit) + deterministic replay test + thin convex/request.ts handlers (AUD-02)

### Phase 5: Approval Routing (Reference Decision Consumer)

**Goal**: Ship the first reference Decision Consumer. Resolve supervisor reporting lines (`managerId`) and role registries to dynamically construct sequential, multi-stage approval task chains from Request-Approval Decisions. This phase demonstrates how external consumers act on Decisions; the runtime itself remains agnostic to it.
**Depends on**: Phase 4
**Requirements**: DEC-03
**Success Criteria**:

1. `ApprovalRoutingService` subscribes to Request-Approval Decisions emitted by the runtime; the runtime has no compile-time dependency on routing.
2. Dynamically resolves supervisor/reporting managers using User `managerId` references.
3. Resolves target tenant roles per review step using the dynamic Roles registry.
4. Generates sequential multi-stage Approval Tasks (e.g. Stage 1 must pass before Stage 2 activates).
5. Approver actions (Approve, Reject) trigger deterministic task state transitions.

**Plans**: 2 plans

**Wave 1**

- [ ] 05-01-PLAN.md — approval/ module foundation (branded IDs, entities, pure state machine, events, errors, ports, in-memory fakes, ESLint zone) + additive ripples: EventDispatcher D-54 hardening, TenantContext.actorId, RequestEvaluation.requesterId threading.

**Wave 2** _(blocked on Wave 1)_

- [ ] 05-02-PLAN.md — ApprovalRoutingService (manager-walk resolver + materialize + idempotency + failure-swallow + Approve/Reject state machine), approval.\* by-reference audit subscriber, Convex adapters/mappers/schema (approvalChains/approvalTasks + requesterId), thin DI subscription on "RequestEvaluated", and live Convex push.

### Phase 6: Admin Portal & UI Dashboard

**Goal**: Build a highly premium React web interface with a dark-mode theme, live Monaco JSON policy editor, active request logs, and interactive supervisor dashboards.
**Depends on**: Phase 5
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria**:

1. Admin portal embeds Monaco Editor featuring live JSON Schema autocomplete and error hints (driven by the runtime's schema).
2. Request center displays dynamic submission forms (EvaluationContext intake) and rich execution logs visualization.
3. Personal dashboard features active inbox tasks allowing fast Approve/Reject actions.
4. Governance module visualizes audit trails and comparative policy version lists.

**Plans**: 5 plans

**Wave 1**

- [ ] 06-01-PLAN.md — Backend read paths (listByTenant/listByPolicy/findByApprover) + runtime schema barrel export (D-59) + Wave 0 tests (schema parity, tenant isolation).

**Wave 2** _(blocked on 06-01)_

- [ ] 06-02-PLAN.md — Thin Convex handlers (policy/approval/audit/request-list) + idempotent demo seed (D-61, D-62).

**Wave 3** _(blocked on 06-02)_

- [ ] 06-03-PLAN.md — Vite + React 19 SPA scaffold, shadcn dark HSL theme, app shell + Demo Context Selector + routing (D-55/56/57, D-V1..3).

**Wave 4** _(blocked on 06-03)_

- [ ] 06-04-PLAN.md — Admin Policy Portal: Monaco editor (canonical-schema autocomplete) + version/lifecycle panel (UI-01, D-58/59/60).
- [ ] 06-05-PLAN.md — Request Center + Personal Inbox + Governance Viewer + live cross-user reactive flow (UI-02/03/04, D-63).

---

## Progress

**Execution Order**:
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase                                             | Plans Complete | Status      | Completed  |
| ------------------------------------------------- | -------------- | ----------- | ---------- |
| 1. Core Platform Foundations                      | 4/4            | Completed   | 2026-05-31 |
| 2. Policy Runtime Core                            | 3/3            | Completed   | 2026-06-01 |
| 3. Policy Lifecycle                               | 2/2            | Complete    | 2026-06-02 |
| 4. Request Runtime                                | 2/2            | Complete    | 2026-06-03 |
| 5. Approval Routing (Reference Decision Consumer) | 0/2            | Not started | -          |
| 6. Admin Portal & UI Dashboard                    | 0/5            | Not started | -          |

---

_Last updated: 2026-06-01 — Phase 2 (Policy Runtime Core) closed. 3/3 plans shipped (02-01 schema + Ajv adapter, 02-02 pure-TS evaluator + trace, 02-03 validateAndEvaluate composer + e2e fixtures), 100% test coverage on `src/modules/runtime/\*\*/_.ts`, ~95.69% global. CTX-01, CTX-02, RUN-01, RUN-02, RUN-03, DEC-02 validated. Ready for `/gsd:verify-work 2`then`/gsd:discuss-phase 3` (Policy Lifecycle).\*
