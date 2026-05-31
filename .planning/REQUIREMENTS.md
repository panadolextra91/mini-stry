# Requirements: Mini-stry (Policy Runtime Platform)

**Defined:** 2026-05-31
**Core Value:** Executes secure, deterministic, and immutable policy decisions and sequential multi-stage approval chains from dynamic context inputs without hardcoding domain-specific logic.

## v1 Requirements

Requirements for the initial release (MVP). Each maps to a corresponding roadmap phase.

### Policy Definition & Versioning (POL)

- [ ] **POL-01**: Support creating policies representing custom rules for arbitrary request types (e.g. "leave_request", "purchase_authorization").
- [ ] **POL-02**: Support publishing policies, which increments the version number.
- [ ] **POL-03**: Guarantee absolute immutability of policy versions once published.
- [ ] **POL-04**: Track the single active policy version for each request type, allowing seamless activation and version rollback.
- [ ] **POL-05**: Establish `PolicyEntity` domain skeleton in Phase 1 to define policies as first-class citizens.
- [ ] **POL-06**: Establish `PolicyVersionEntity` domain skeleton in Phase 1 to define immutable version structures.

### Evaluation Runtime & DSL (RUN)

- [ ] **RUN-01**: Define a human-readable text-based DSL syntax (e.g., specifying conditions based on variables like `leave_days <= 2` and assigning dynamic approvers).
- [ ] **RUN-02**: Implement a deterministic, safe lexical scanner, parser, and interpreter in pure TypeScript without using `eval()` or dynamic code execution.
- [ ] **RUN-03**: Validate DSL syntax and check for semantic errors (e.g. referencing unregistered roles or undefined inputs) before allowing policy publication.

### Decision & Approval Generation (DEC)

- [ ] **DEC-01**: Support evaluating dynamic request context payloads against active policy DSL rules.
- [ ] **DEC-02**: Generate structured decisions (e.g. Auto-Approve, Auto-Reject) dynamically based on parser outputs.
- [ ] **DEC-03**: Generate sequential multi-stage approval chains (Approval Tasks) when evaluation conditions require human intervention.

### Audit Logging & Governance (AUD)

- [ ] **AUD-01**: Create immutable audit log records when policies are published, activated, or rolled back.
- [ ] **AUD-02**: Create audit log records tracking the exact decision path of policy evaluations and individual approval decisions.
- [ ] **AUD-03**: Establish foundational `AuditLogEntity` domain skeleton in Phase 1 to lay the groundwork for governance.

### Multi-Tenant Context & Directory Providers (CON)

- [ ] **CON-01**: Support strict logical data isolation across multiple tenant organizations.
- [ ] **CON-02**: Support dynamic Roles configured in the database per tenant and registered via a dedicated `RoleService`.
- [ ] **CON-03**: Support Users belonging to a tenant, linked via a stable, unique `roleId` to dynamic role definitions.
- [ ] **CON-04**: Support dynamic supervisor reporting lines (`managerId` / reports-to link) on Users to resolve relative hierarchy paths during evaluation.

### User Interface (UI)

- [ ] **UI-01**: Admin Policy Portal: view and manage policies, featuring a Monaco Editor panel for writing DSL rules with live syntax validation.
- [ ] **UI-02**: Request Log: submit request payloads and track their active evaluation/approval states.
- [ ] **UI-03**: Personal Inbox: unified dashboard for approvers to view pending approval tasks and record Approve/Reject decisions.
- [ ] **UI-04**: Governance Viewer: inspect policy version histories and step-by-step approval decision logs.

---

## v2 Requirements

### Advanced Evaluation
- **RUN-04**: Support logical operators (`AND`, `OR`, `NOT`) and nested groupings in DSL conditions.
- **DEC-04**: Support parallel approval groups (e.g., approval required by *any two* managers).
- **DEC-05**: Support SLA deadlines and auto-escalation or auto-approval rules.

### Integrations
- **INT-01**: Slack/Teams notification integration for pending approvals.
- **INT-02**: Calendar integrations (e.g., post approved leave calendars).

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Attendance Tracking & Timesheets | High complexity, HR-specific feature, not core to the policy runtime. |
| Payroll Processing | Highly regulated, HR-specific, requires dedicated calculation engines. |
| Performance Reviews & Directories | HR features that do not showcase policy execution. |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| POL-05 | Phase 1 (Safe Policy Runtime) | Pending |
| POL-06 | Phase 1 (Safe Policy Runtime) | Pending |
| RUN-02 | Phase 1 (Safe Policy Runtime) | Pending |
| AUD-03 | Phase 1 (Safe Policy Runtime) | Pending |
| POL-01 | Phase 2 (Versioning & Publishing) | Pending |
| POL-02 | Phase 2 (Versioning & Publishing) | Pending |
| POL-03 | Phase 2 (Versioning & Publishing) | Pending |
| POL-04 | Phase 2 (Versioning & Publishing) | Pending |
| RUN-01 | Phase 3 (DSL Syntax & Validation) | Pending |
| RUN-03 | Phase 3 (DSL Syntax & Validation) | Pending |
| DEC-01 | Phase 4 (Evaluation & Decisions) | Pending |
| DEC-02 | Phase 4 (Evaluation & Decisions) | Pending |
| DEC-03 | Phase 4 (Evaluation & Decisions) | Pending |
| CON-01 | Phase 5 (Multi-Tenant Context) | Pending |
| CON-02 | Phase 5 (Multi-Tenant Context) | Pending |
| CON-03 | Phase 5 (Multi-Tenant Context) | Pending |
| CON-04 | Phase 5 (Multi-Tenant Context) | Pending |
| AUD-01 | Phase 6 (Audit Governance) | Pending |
| AUD-02 | Phase 6 (Audit Governance) | Pending |
| UI-01 | Phase 7 (Monaco UI Dashboard) | Pending |
| UI-02 | Phase 7 (Monaco UI Dashboard) | Pending |
| UI-03 | Phase 7 (Monaco UI Dashboard) | Pending |
| UI-04 | Phase 7 (Monaco UI Dashboard) | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-31*
*Last updated: 2026-05-31 after initial definition*
