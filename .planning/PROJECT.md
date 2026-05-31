# Project: Mini-stry (Policy Runtime Platform)

## What This Is

Mini-stry is a domain-neutral **Policy Runtime Platform**. The runtime is modeled as a pure function:

```
Policy + EvaluationContext  →  Decision
```

The runtime consumes a structured **JSON Policy** and an **EvaluationContext** (an arbitrary domain payload — e.g. `{leave_days, requester_role}`, `{amount, department}`, `{resource, requester_role}`), validates the policy against a JSON Schema, evaluates its rules against the context, and produces a deterministic **Decision** (Auto-Approve, Auto-Reject, Request-Approval, or any future outcome).

**Decision Consumers** (such as sequential multi-stage approval routing) act on Decisions but are external to the runtime. The runtime does not depend on, know about, or import any consumer. Leave approval and the approval routing workflow are strictly demonstration consumers — not part of the core runtime.

Policy authoring (JSON → DSL → Visual Builder) is treated as a replaceable front-end detail. The core Policy Runtime remains stable, deterministic, and domain-neutral.

## Core Value

Executes secure, deterministic, and immutable policy decisions by evaluating structured JSON policies against an **EvaluationContext**. Decision Consumers (such as approval routing) act on these decisions but are not part of the runtime core.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **CON-01 (Multi-Tenancy)**: Support strict logical data isolation across multiple tenant organizations.
- [ ] **CON-02 (Dynamic Roles)**: Support dynamic, data-driven roles configured per tenant in the database.
- [ ] **CON-03 (Stable User-Role Reference)**: Link users to roles via stable `roleId` references, preventing renaming failures.
- [ ] **CON-04 (Supervisor Reporting Line)**: Support supervisor/reports-to references (`managerId`) on users to resolve dynamic reporting structures.
- [ ] **CTX-01 (EvaluationContext as First-Class Input)**: Model the runtime input as a structured `EvaluationContext` — a domain-neutral key/value payload. The runtime formula is `Policy + EvaluationContext = Decision`.
- [ ] **CTX-02 (Domain-Neutral Context Interface)**: Define `EvaluationContext` as a Pure-TS interface with no hardcoded domain-specific fields. Domain shape is supplied per-request by callers.
- [ ] **POL-01 (Policy Definition)**: Support defining policies containing structured JSON rule blocks.
- [ ] **POL-02 (Policy Lifecycle & Immutability)**: Support immutable policy versions once published, allowing active version selection and safe rollbacks.
- [ ] **RUN-01 (Structured JSON Policy Schemas)**: Define structured JSON rule schemas with relational operators and variable lookups against the EvaluationContext.
- [ ] **RUN-02 (Safe Rule Evaluation)**: Implement a deterministic, safe rule and condition evaluation engine in Pure TypeScript (NO `eval()` or dynamic code execution).
- [ ] **RUN-03 (JSON Schema Validation)**: Enforce strict JSON Schema validation for policies natively within the runtime core, as a **prerequisite for safe evaluation**. An invalid policy must never reach the evaluator.
- [ ] **DEC-01 (Decision Generator)**: Evaluate an `EvaluationContext` against active JSON policies to output structured Decisions (e.g. Auto-Approve, Auto-Reject, Request-Approval). The Decision type is open — future outcomes plug into the same shape.
- [ ] **DEC-03 (Reference Decision Consumer — Approval Routing)**: Ship a reference Decision Consumer that converts Request-Approval decisions into sequential multi-stage approval chains. One consumer among many possible; the runtime has no compile-time dependency on it.
- [ ] **AUD-01 (Immutable Governance Ledger)**: Record secure audit log entries for all policy publication lifecycle events and step-by-step decision/execution paths.
- [ ] **UI-01 (Admin and User Portal)**: Provide a React client dashboard featuring a Monaco JSON Editor with schema autocomplete, request submission logs, and personal approval dashboards.

### Out of Scope

- **Custom DSL Compiler & Parsers** — Lexer, parser, AST compiler, and custom expression grammar are explicitly out of scope for the MVP. Policies are parsed natively as structured JSON.
- **HR SaaS Features** — Payroll, attendance tracking, and recruitment are out of scope.
- **Visual DSL and Workflow Builders** — Out of scope. Policies are authored inside a Monaco-based JSON editor.

## Context

We are building a highly decoupled, modular policy engine. To guarantee extreme maintainability and prevent domain leaks, we are utilizing **Hexagonal Architecture (Ports & Adapters)** in a **Modular Monolith** style.

- **Domain Layer**: Contains the core logic of the Policy Engine, the `EvaluationContext` data shape, dynamic JSON condition evaluators, and foundational entities (**Tenant, User, Role, Policy, PolicyVersion, AuditLog**) in Pure TS. Completely isolated.
- **Application Layer**: Contains services executing actions and orchestrating business logic:
  - **PolicyRuntimeService**: Orchestrates JSON Schema validation followed by condition evaluation against the `EvaluationContext`, and emits a Decision.
  - **RoleService**: Manages dynamic role registries.
  - **UserService**: Manages user profiles and supervisor reporting lines.
  - **Decision Consumers** (e.g. `ApprovalRoutingService`): External services that act on Decisions. The runtime does not depend on any consumer.
- **Adapter Layer**: Implements persistence and communication adapters (Convex).

## Constraints

- **Domain-Neutrality Constraint**: The core platform must remain 100% domain-neutral. No HR-specific static code, role enums, or HR-only primitives are allowed in the domain layer. `EvaluationContext` must remain a structurally-typed, key/value payload — never a domain-typed record.
- **Architecture Constraint**: Absolute adherence to Modular Monolith + Hexagonal Architecture (Ports & Adapters). **Module Boundary Rule:** *Cross-module imports are ALLOWED through public APIs (per-module barrel `index.ts`); cross-module coupling is NOT — deep imports into another module's `adapters/`, `domain/`, or `application/` internals are prohibited.* Decision Consumers may depend on the runtime; the runtime may not depend on consumers.
- **Testing Constraint**: 100% test coverage for the Policy Engine (schema validator, condition evaluator), Policy Versioning, and Decision Generation. 90%+ coverage on all critical business logic.
- **Security Constraint**: No usage of `eval()` or dynamic JS/TS code generation. The JSON condition evaluator must compare properties strictly using TypeScript relational operators. Policies must pass JSON Schema validation before any evaluation runs.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| JSON Policy Model | Using structured JSON rule blocks instead of building a custom language parser reduces overengineering risk, keeps the execution runtime simple, and accelerates MVP validation. | Approved |
| Core Platform Foundations First | Establishing Tenants, Users, dynamic ID-based Roles, and Policy domain skeletons in Phase 1 ensures a solid data-model baseline before executing evaluations. | Approved |
| ID-based Role References | Storing role name strings directly on users creates coupling. Using a stable `roleId` keeps user linkages stable even if roles are renamed. | Approved |
| DSL-First Approach Rejection | Replaced custom policy DSL parser, AST compiler, and lexer with standard structured JSON policies to eliminate compiler complexity, avoid overengineering, and focus strictly on policy runtime validation. | Approved |
| EvaluationContext as First-Class Concept | Formalized `EvaluationContext` (CTX-01, CTX-02) as a named architectural concept. Without an explicit name for runtime input, downstream phases drift into ad-hoc payload conventions and the runtime accidentally couples to a domain shape. | Approved |
| JSON Schema Validation Belongs in Runtime Core | Schema validation is a prerequisite for safe evaluation: the evaluator cannot be trusted to run on an unvalidated policy. RUN-03 moved from Phase 3 (Lifecycle) to Phase 2 (Runtime Core). Lifecycle (save / publish / activate) re-uses the same validator at its boundaries. | Approved |
| Decision Consumers Are External to the Runtime | Approval Routing is one Decision Consumer among many possible (notifications, escalations, future integrations). The runtime emits Decisions; it does not own consumers. Phase 5 is reframed as a *reference consumer*, not the runtime's purpose. | Approved |

## Concept Hierarchy

Canonical mental model. Use this as the reference order of importance for all future planning and implementation. Lower-numbered concepts may not depend on higher-numbered ones.

1. **Policy** — the rule definition authored by an admin
2. **Policy Version** — immutable snapshot of a Policy
3. **EvaluationContext** — runtime input payload (domain-neutral key/value)
4. **Policy Runtime** — pure-function evaluator: JSON Schema validation + condition evaluation
5. **Decision** — deterministic runtime output (Auto-Approve, Auto-Reject, Request-Approval, future outcomes)
6. **Decision Consumers** — external services that act on Decisions (approval routing, notifications, escalations, ...)
7. **Tenants** — multi-tenant isolation boundary
8. **Roles & Users** — directory primitives referenced by policies and consumers
9. **Audit Log** — immutable governance ledger over policies, decisions, and consumer actions
10. **UI** — Admin Portal, Request Logs, Approver Inbox (front-end consumers of the runtime)

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted
6. Concept Hierarchy still accurate? → Update only if a foundational abstraction is added/removed

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-31 after Final Architecture Alignment Review + Phase 1 Discuss-Phase alignment (Architecture Constraint reworded to Module Boundary Rule per discuss-phase; DEC-03 numbering corrected to match REQUIREMENTS.md)*
