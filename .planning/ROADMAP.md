# Roadmap: Mini-stry (Policy Runtime Platform)

## Overview

Mini-stry's development journey is structured around the runtime formula:

```
Policy + EvaluationContext  →  Decision  →  Decision Consumers
```

**Phase 1** establishes the multi-tenant directory primitives (Tenants, Users, dynamic Roles, domain skeletons). **Phase 2** implements the Policy Runtime Core — defines the `EvaluationContext` interface, structured JSON rule schemas, native JSON Schema validation (a prerequisite to evaluation), the safe Pure-TS evaluator, and base Decision emission. **Phase 3** wraps the runtime in a Policy Lifecycle — draft, publish, immutability, rollback, audit. **Phase 4** introduces the request submission runtime and decision-path tracing. **Phase 5** ships the first reference Decision Consumer — sequential supervisor approval routing — to demonstrate the runtime's downstream pluggability. **Phase 6** delivers a premium Monaco-based React admin portal.

The runtime stays domain-neutral. Approval routing is one consumer among many; it is not the runtime's purpose.

## Phases

- [ ] **Phase 1: Core Platform Foundations** - Establish modular directory structure, domain entity interfaces, Convex schemas (Tenants, Users, dynamic ID-based Roles, initial skeletons for Policy, PolicyVersion, AuditLog), and decoupled Application Services (RoleService and UserService) verified with Vitest.
- [ ] **Phase 2: Policy Runtime Core** - Define the `EvaluationContext` interface, structured JSON rule schemas, native JSON Schema validation (prerequisite to evaluation), the safe relational evaluator (Pure TS, no `eval()`), and base Decision emission.
- [ ] **Phase 3: Policy Lifecycle** - Wrap the runtime in a draft → publish → activate → rollback lifecycle with immutable versioning. Reuse the runtime's JSON Schema validator at lifecycle boundaries.
- [ ] **Phase 4: Request Runtime** - Orchestrate evaluation payloads submitted as EvaluationContexts to active policies, persist decision records, and trace step-by-step execution paths.
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
**Plans**: 3 plans
- [ ] 01-01: Establish Hexagonal directory structure and pure-TS domain entity interfaces (Tenant, User, Role, Policy, PolicyVersion, AuditLog).
- [ ] 01-02: Design Convex database schemas with strict logical isolation multi-tenant index fields.
- [ ] 01-03: Implement decoupled RoleService and UserService application layers, Convex persistence adapters, and Vitest test suites.

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
- [ ] 02-01: Define the `EvaluationContext` interface and structured JSON policy rule schemas; ship the JSON Schema validator as the runtime's first checkpoint.
- [ ] 02-02: Implement deterministic Pure-TS JSON Policy Condition Evaluator with relational logic over the EvaluationContext.
- [ ] 02-03: Implement base Decision emitter yielding structured Decisions from rule evaluation results.

### Phase 3: Policy Lifecycle
**Goal**: Wrap the runtime in an administrative lifecycle — draft, publish (immutable), activate, rollback — and persist policy publication audit logs. Lifecycle operations reuse the runtime's JSON Schema validator at their boundaries.
**Depends on**: Phase 2
**Requirements**: POL-01, POL-02, POL-03, POL-04, AUD-01
**Success Criteria**:
  1. Draft modifications invoke the runtime-layer JSON Schema validator before save.
  2. Modifying a published policy throws an explicit error, guaranteeing absolute version immutability.
  3. Active-version tracking allows seamless updates and instant rollbacks to arbitrary version IDs.
  4. Policy publication/rollback events logged to immutable audit records.
**Plans**: 2 plans
- [ ] 03-01: Implement draft modifications calling the runtime schema validator, and immutable publishing logic.
- [ ] 03-02: Implement active-state selector, rollback handler, and Convex lifecycle persistence adapters.

### Phase 4: Request Runtime
**Goal**: Orchestrate request payload submissions as EvaluationContexts, run them through the Policy Runtime against active policy versions, and persist decision-path traces.
**Depends on**: Phase 3
**Requirements**: DEC-01, AUD-02
**Success Criteria**:
  1. PolicyRuntimeService successfully runs submitted EvaluationContexts against active JSON rules.
  2. Records step-by-step evaluation results, storing the precise decision path mapped during the run.
**Plans**: 2 plans
- [ ] 04-01: Implement request submission handlers (EvaluationContext intake) and PolicyRuntimeService orchestration logic.
- [ ] 04-02: Implement step-by-step path tracer and record outcomes to AuditLogs.

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
- [ ] 05-01: Implement role and supervisor reporting hierarchy dynamic resolvers.
- [ ] 05-02: Implement sequential approval task generator and step-by-step approval state machine, subscribed to runtime Decisions.

### Phase 6: Admin Portal & UI Dashboard
**Goal**: Build a highly premium React web interface with a dark-mode theme, live Monaco JSON policy editor, active request logs, and interactive supervisor dashboards.
**Depends on**: Phase 5
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria**:
  1. Admin portal embeds Monaco Editor featuring live JSON Schema autocomplete and error hints (driven by the runtime's schema).
  2. Request center displays dynamic submission forms (EvaluationContext intake) and rich execution logs visualization.
  3. Personal dashboard features active inbox tasks allowing fast Approve/Reject actions.
  4. Governance module visualizes audit trails and comparative policy version lists.
**Plans**: 3 plans
- [ ] 06-01: Bootstrap modern React routes, visual layouts, and dark mode design HSL variables.
- [ ] 06-02: Build Admin Policy Portal with autocomplete Monaco JSON Editor and schema check panel.
- [ ] 06-03: Build Request Logs visualizer, Approver Personal Inbox, and Governance timeline dashboards.

---

## Progress

**Execution Order**:
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Platform Foundations | 0/3 | Ready to plan | - |
| 2. Policy Runtime Core | 0/3 | Not started | - |
| 3. Policy Lifecycle | 0/2 | Not started | - |
| 4. Request Runtime | 0/2 | Not started | - |
| 5. Approval Routing (Reference Decision Consumer) | 0/2 | Not started | - |
| 6. Admin Portal & UI Dashboard | 0/3 | Not started | - |

---
*Last updated: 2026-05-31 after Final Architecture Alignment Review (RUN-03 moved Phase 3 → Phase 2; CTX-01/CTX-02 added to Phase 2; Phase 5 reframed as Reference Decision Consumer).*
