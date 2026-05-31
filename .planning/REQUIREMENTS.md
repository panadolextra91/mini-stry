# Requirements: Mini-stry (Policy Runtime Platform)

**Defined:** 2026-05-31
**Core Value:** Executes secure, deterministic, and immutable policy decisions by evaluating structured JSON policies against an **EvaluationContext**. Decision Consumers (such as approval routing) act on these decisions but are not part of the runtime core.

## v1 Requirements

Requirements for the initial release (MVP). Each maps to a corresponding roadmap phase.

### Multi-Tenant Context & Directory Providers (CON)

- [x] **CON-01**: Support strict logical data isolation across multiple tenant organizations.
- [x] **CON-02**: Support dynamic Roles configured in the database per tenant and registered via a dedicated `RoleService`.
- [x] **CON-03**: Support Users belonging to a tenant, linked via a stable, unique `roleId` to dynamic role definitions.
- [x] **CON-04**: Support dynamic supervisor reporting lines (`managerId` / reports-to link) on Users to resolve relative hierarchy paths during evaluation.

### Evaluation Context (CTX)

- [ ] **CTX-01**: Model runtime input as a structured `EvaluationContext` — a domain-neutral key/value payload consumed by the Policy Runtime. The runtime formula is `Policy + EvaluationContext = Decision`.
- [ ] **CTX-02**: Define `EvaluationContext` as a Pure-TS interface with no hardcoded domain-specific fields. Callers supply the concrete shape per request; the runtime never embeds HR or domain primitives into the context type.

### Policy Definition & Versioning (POL)

- [ ] **POL-01**: Support creating policies containing structured JSON rule blocks representing custom rules for arbitrary request types.
- [ ] **POL-02**: Support publishing policies, which increments the version number.
- [ ] **POL-03**: Guarantee absolute immutability of policy versions once published.
- [ ] **POL-04**: Track the single active policy version for each request type, allowing seamless activation and version rollback.
- [ ] **POL-05**: Establish `PolicyEntity` domain skeleton in Phase 1 to define policies as first-class citizens.
- [ ] **POL-06**: Establish `PolicyVersionEntity` domain skeleton in Phase 1 to define immutable version structures.

### Policy Runtime — Schema Validation & Evaluation (RUN)

- [ ] **RUN-01**: Implement structured JSON policy schemas that represent conditional operations (e.g. `{ "field": "leave_days", "operator": "gt", "value": 2 }`) over the EvaluationContext.
- [ ] **RUN-02**: Implement a deterministic, safe condition evaluation engine in Pure TypeScript (NO `eval()` or dynamic code execution).
- [ ] **RUN-03**: Enforce strict JSON Schema validation for policies as a **prerequisite to evaluation**. Schema validation lives in the runtime core (not the lifecycle layer); the evaluator must never run on an invalid policy. Lifecycle operations (save, publish, activate) reuse the same validator at their boundaries.

### Decision Generation & Decision Consumers (DEC)

- [ ] **DEC-01**: Evaluate an `EvaluationContext` against active policy JSON rules and emit a structured **Decision**.
- [ ] **DEC-02**: Generate Auto-Approve, Auto-Reject, and Request-Approval Decisions deterministically based on condition evaluations. The Decision type is open — future outcomes (escalation, info-request, etc.) plug into the same shape without runtime changes.
- [ ] **DEC-03**: Ship a reference **Decision Consumer — Approval Routing** — that converts Request-Approval Decisions into sequential multi-stage approval chains. One consumer among many possible; the runtime has no compile-time dependency on it.

### Audit Logging & Governance (AUD)

- [ ] **AUD-01**: Create immutable audit log records when policies are published, activated, or rolled back.
- [ ] **AUD-02**: Create audit log records tracking the exact decision path of policy evaluations and individual approval decisions.
- [ ] **AUD-03**: Establish foundational `AuditLogEntity` domain skeleton in Phase 1 to lay the groundwork for governance.

### User Interface (UI)

- [ ] **UI-01**: Admin Policy Portal: view and manage policies, featuring a Monaco Editor panel for writing JSON rules with schema autocomplete.
- [ ] **UI-02**: Request Log: submit request payloads (EvaluationContexts) and track their active evaluation/decision states.
- [ ] **UI-03**: Personal Inbox: unified dashboard for approvers to view pending approval tasks and record Approve/Reject decisions.
- [ ] **UI-04**: Governance Viewer: inspect policy version histories and step-by-step decision logs.

---

## v2 Requirements

### Advanced Evaluation
- **RUN-04**: Support logical operators (`AND`, `OR`, `NOT`) inside JSON policy rules.
- **DEC-04**: Support parallel approval groups (e.g., approval required by *any two* managers).
- **DEC-05**: Support SLA deadlines and auto-escalation or auto-approval rules.
- **DEC-06**: Additional Decision Consumers (notifications, webhook dispatch, calendar posting) plugged on top of the same Decision stream.

### Integrations
- **INT-01**: Slack/Teams notification integration for pending approvals.
- **INT-02**: Calendar integrations (e.g., post approved leave calendars).

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom DSL compiler, Lexers, and Parsers | Overengineering for the MVP. Standard JSON policies are completely sufficient. |
| Attendance Tracking & Timesheets | High complexity, HR-specific feature, not core to the policy runtime. |
| Payroll Processing | Highly regulated, HR-specific, requires dedicated calculation engines. |
| Performance Reviews & Directories | HR features that do not showcase policy execution. |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CON-01 | Phase 1: Core Platform Foundations | Pending |
| CON-02 | Phase 1: Core Platform Foundations | Pending |
| CON-03 | Phase 1: Core Platform Foundations | Pending |
| CON-04 | Phase 1: Core Platform Foundations | Pending |
| POL-05 | Phase 1: Core Platform Foundations | Pending |
| POL-06 | Phase 1: Core Platform Foundations | Pending |
| AUD-03 | Phase 1: Core Platform Foundations | Pending |
| CTX-01 | Phase 2: Policy Runtime Core | Pending |
| CTX-02 | Phase 2: Policy Runtime Core | Pending |
| RUN-01 | Phase 2: Policy Runtime Core | Pending |
| RUN-02 | Phase 2: Policy Runtime Core | Pending |
| RUN-03 | Phase 2: Policy Runtime Core | Pending |
| DEC-02 | Phase 2: Policy Runtime Core | Pending |
| POL-01 | Phase 3: Policy Lifecycle | Pending |
| POL-02 | Phase 3: Policy Lifecycle | Pending |
| POL-03 | Phase 3: Policy Lifecycle | Pending |
| POL-04 | Phase 3: Policy Lifecycle | Pending |
| AUD-01 | Phase 3: Policy Lifecycle | Pending |
| DEC-01 | Phase 4: Request Runtime | Pending |
| AUD-02 | Phase 4: Request Runtime | Pending |
| DEC-03 | Phase 5: Approval Routing (Reference Decision Consumer) | Pending |
| UI-01 | Phase 6: Admin Portal & UI Dashboard | Pending |
| UI-02 | Phase 6: Admin Portal & UI Dashboard | Pending |
| UI-03 | Phase 6: Admin Portal & UI Dashboard | Pending |
| UI-04 | Phase 6: Admin Portal & UI Dashboard | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

**Changes vs prior revision:**
- Added CTX section (CTX-01, CTX-02) — EvaluationContext promoted to first-class.
- RUN-03 (JSON Schema Validation) moved from Phase 3 → Phase 2 (prerequisite for safe evaluation).
- DEC section renamed to "Decision Generation & Decision Consumers"; DEC-03 reframed as one reference consumer among many.
- Phase 5 title updated to clarify it is a Reference Decision Consumer, not the runtime's purpose.

---
*Requirements defined: 2026-05-31*
*Last updated: 2026-05-31 after Final Architecture Alignment Review*
