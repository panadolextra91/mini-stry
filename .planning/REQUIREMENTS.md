# Requirements: Mini-stry

**Defined:** 2026-05-31
**Core Value:** Empowers organizations to dynamically define, version, and execute custom business rules and multi-stage approval workflows without hardcoding domain-specific logic.

## v1 Requirements

Requirements for the initial release (MVP). Each maps to a corresponding roadmap phase.

### Authentication & Tenant System (SYS)

- [ ] **SYS-01**: Support multi-tenancy with strict data isolation between tenant organizations.
- [ ] **SYS-02**: Support users belonging to a tenant, with explicit roles (`employee`, `manager`, `hr_head`, `ceo`).
- [ ] **SYS-03**: Support direct reporting manager relationships for users to enable relative approval assignments (e.g., `approve_by: manager`).

### Policy Management (POL)

- [ ] **POL-01**: Support creating policies linked to a specific request type (e.g. "leave_request").
- [ ] **POL-02**: Support publishing policies, which increments the version number.
- [ ] **POL-03**: Guarantee immutability of policy versions once published (no modifications to existing versions).
- [ ] **POL-04**: Track the single active policy version for each request type in a tenant, allowing rollback to previous versions.

### DSL & Interpreter Engine (DSL)

- [ ] **DSL-01**: Define a human-readable text-based DSL syntax (e.g., specifying conditions based on variables like `leave_days <= 2` and assigning approvers).
- [ ] **DSL-02**: Implement a deterministic, safe lexical scanner, parser, and interpreter in pure TypeScript without using `eval()` or dynamic code execution.
- [ ] **DSL-03**: Validate DSL syntax and check for semantic errors (e.g. referencing non-existent roles/variables) before allowing publishing.

### Request Submission & Evaluation (REQ)

- [ ] **REQ-01**: Support submitting requests containing a dynamic payload (e.g., `{ leave_days: 5, reason: "Vacation" }`).
- [ ] **REQ-02**: Evaluate a request against the active policy version's DSL rules using the dynamic payload and user context (e.g. user role and manager).
- [ ] **REQ-03**: Generate a structured, sequential approval chain (Approval Tasks) dynamically based on matching DSL rule outputs.

### Approval Workflow & Tasks (APP)

- [ ] **APP-01**: Support approval tasks assigned to specific users based on their roles or relationships (e.g. the submitter's manager).
- [ ] **APP-02**: Allow authorized approvers to Approve or Reject a task.
- [ ] **APP-03**: Transition request status automatically based on task decisions: moves to `approved` when all chain tasks are approved, or `rejected` immediately if any task is rejected.

### Audit Logging (AUD)

- [ ] **AUD-01**: Create immutable audit log records when policies are published, activated, or rolled back.
- [ ] **AUD-02**: Create audit log records tracking the exact decision path of policy evaluations and individual approval decisions.

### User Interface (UI)

- [ ] **UI-01**: Tenant Admin Portal: view and manage policies, with a Monaco Editor interface for writing DSL rules.
- [ ] **UI-02**: Employee Portal: submit new leave requests and track the progress of their submitted requests.
- [ ] **UI-03**: Approval Inbox: unified, real-time dashboard for managers/executives to view pending tasks and make approve/reject decisions.
- [ ] **UI-04**: Audit Log Viewer: view history of policy versions and approval audit trails.

---

## v2 Requirements

Acknowledged but deferred to future milestones.

### Advanced DSL Features
- **DSL-04**: Support logical operators (`AND`, `OR`, `NOT`) and nested parentheses in conditions.
- **DSL-05**: Support parallel approval groups (e.g., approval required by *any two* managers).
- **DSL-06**: Support SLA deadlines and auto-escalation or auto-approval rules.

### Integrations
- **INT-01**: Slack/Teams notification integration for pending approvals.
- **INT-02**: Calendar integrations (e.g., automatically post approved leaves to Google Calendar).

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Attendance Tracking & Timesheets | High complexity, not core to the policy engine product. |
| Payroll Processing | Highly regulated, requires complex calculation engines and bank integrations. |
| Performance Reviews & Feedback | Standard HR features that do not showcase the dynamic policy engine capabilities. |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SYS-01 | Phase 1 (Tenant & Core Setup) | Pending |
| SYS-02 | Phase 1 (Tenant & Core Setup) | Pending |
| SYS-03 | Phase 1 (Tenant & Core Setup) | Pending |
| DSL-01 | Phase 2 (DSL Interpreter) | Pending |
| DSL-02 | Phase 2 (DSL Interpreter) | Pending |
| DSL-03 | Phase 2 (DSL Interpreter) | Pending |
| POL-01 | Phase 3 (Policy & Versioning) | Pending |
| POL-02 | Phase 3 (Policy & Versioning) | Pending |
| POL-03 | Phase 3 (Policy & Versioning) | Pending |
| POL-04 | Phase 3 (Policy & Versioning) | Pending |
| REQ-01 | Phase 4 (Request Submission & Eval) | Pending |
| REQ-02 | Phase 4 (Request Submission & Eval) | Pending |
| REQ-03 | Phase 4 (Request Submission & Eval) | Pending |
| APP-01 | Phase 5 (Approval Workflow Engine) | Pending |
| APP-02 | Phase 5 (Approval Workflow Engine) | Pending |
| APP-03 | Phase 5 (Approval Workflow Engine) | Pending |
| AUD-01 | Phase 6 (Audit Logging) | Pending |
| AUD-02 | Phase 6 (Audit Logging) | Pending |
| UI-01 | Phase 7 (Frontend Application) | Pending |
| UI-02 | Phase 7 (Frontend Application) | Pending |
| UI-03 | Phase 7 (Frontend Application) | Pending |
| UI-04 | Phase 7 (Frontend Application) | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-31*
*Last updated: 2026-05-31 after initial definition*
