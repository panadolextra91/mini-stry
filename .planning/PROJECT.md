# Project: Mini-stry (Policy Runtime Platform)

## What This Is

Mini-stry is a domain-neutral **Policy Runtime Platform** that compiles, versions, and executes custom business rules dynamically. Instead of hardcoding domain-specific rules (like leave request parameters or expense approval stages), the platform's behavior is driven entirely by custom policies written in a human-readable, text-based DSL. **Leave approval is strictly a demonstration workflow** used to prove the engine; the runtime itself is domain-agnostic and built to support arbitrary tenant-defined procedures.

## Core Value

Executes secure, deterministic, and immutable policy decisions and sequential multi-stage approval chains from dynamic context inputs without hardcoding domain-specific logic.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **POL-01 (Policy Definition)**: Support creating and defining policies containing human-readable text-based DSL rules.
- [ ] **POL-02 (Policy Versioning & Immutability)**: Support immutable policy versions once published, allowing active version selection and safe rollbacks.
- [ ] **RUN-01 (Safe DSL Interpreter)**: Implement a completely deterministic, safe lexical scanner, parser, and AST interpreter in Pure TypeScript (NO `eval()` or dynamic code execution).
- [ ] **RUN-02 (Syntax & Semantic Validation)**: Compile and validate DSL syntax and check for structural errors before allowing policy publication.
- [ ] **DEC-01 (Decision & Approval Task Generator)**: Evaluate dynamic context payloads against active policies to output structured decisions and sequential multi-stage approval chains.
- [ ] **AUD-01 (Immutable Governance Ledger)**: Record secure audit log entries for all policy publication lifecycle events and step-by-step approval execution paths.
- [ ] **SYS-01 (Multi-Tenancy)**: Support strict logical data isolation across multiple tenant organizations.
- [ ] **SYS-02 (Dynamic Context Providers)**: Support dynamic, data-driven roles linked to users via stable identifiers (`roleId`) and dynamic supervisor reporting links (`managerId`) to feed variables into the runtime.
- [ ] **UI-01 (Monaco Policy Editor & Inbox)**: Provide a React client dashboard featuring a Monaco-based DSL Editor with live syntax feedback, request submission logs, and personal approval dashboards.

### Out of Scope

- **HR SaaS Features** — Payroll, attendance tracking, and recruitment are explicitly out of scope. The platform must remain domain-neutral.
- **Visual DSL and Workflow Builders** — The MVP focuses exclusively on compiling and executing a text-based DSL.
- **CQRS & Complex Infrastructure** — Keep the architecture simple, boring, and consolidated to ship fast and validate the core policy engine.

## Context

We are building a highly decoupled, modular policy engine. To guarantee extreme maintainability and prevent domain leaks, we are utilizing **Hexagonal Architecture (Ports & Adapters)** in a **Modular Monolith** style.
- **Domain Layer**: Contains the core logic of the Policy Engine, dynamic AST parser, and foundational entities (**Policy, PolicyVersion, Tenant, User, Role, AuditLog**) in Pure TS. Completely isolated.
- **Application Layer**: Contains services executing actions and orchestrating business logic:
  - **PolicyRuntimeService**: Orchestrates DSL compilation and dynamic rule evaluations.
  - **RoleService**: Manages dynamic role registries.
  - **UserService**: Manages user profiles and supervisor reporting lines.
- **Adapter Layer**: Implements persistence and communication adapters (Convex).

## Constraints

- **Domain-Neutrality Constraint**: The core platform must remain 100% domain-neutral. No HR-specific static code, role enums, or HR-only primitives are allowed in the domain layer.
- **Architecture Constraint**: Absolute adherence to Modular Monolith + Hexagonal Architecture (Ports & Adapters). No cross-importing between modules at Adapters/Application level.
- **Testing Constraint**: 100% test coverage for the Policy Engine (DSL interpreter), Policy Versioning, and Approval Generation. 90%+ coverage on all critical business logic.
- **Security Constraint**: No usage of `eval()` or dynamic JS/TS code generation. The DSL interpreter must be a deterministic parser.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Policy-First Phase Ordering | By developing the Policy Runtime and DSL Parser in Phase 1 (instead of user directories), we ensure our directories are planned around the engine rather than the engine around directories. | — Pending |
| ID-based Role References | Storing role name strings directly on users creates coupling. Using a stable `roleId` keeps user linkages stable even if roles are renamed. | — Pending |
| Dedicated RoleService | Separates role management (register, rename, list) from user management (register, assign, report), adhering to Single Responsibility. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-31 after initialization*
