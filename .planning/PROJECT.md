# Project: Mini-stry

## What This Is

Mini-stry is a multi-tenant, domain-agnostic policy engine that allows organizations (tenants) to define their own business rules and approval workflows dynamically. Instead of hardcoding business rules (like HR leave policies), the platform's behavior is driven entirely by custom policies written in a human-readable, text-based DSL. The first domain use case is employee leave approval.

## Core Value

Empowers organizations to dynamically define, version, and execute custom business rules and multi-stage approval workflows without hardcoding domain-specific logic.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **SYS-01 (Multi-Tenancy)**: Support isolated data, users, and roles across multiple tenants.
- [ ] **SYS-02 (Dynamic Data-Driven Roles)**: Support custom, tenant-defined roles configured dynamically as database records (e.g. receptionist, monk, supervisor, CEO) rather than static code enums.
- [ ] **SYS-03 (Reporting Lines)**: Support direct reporting links on users to resolve relative approval chains (e.g. reports to supervisor).
- [ ] **POL-01 (Policy Versioning & Publishing)**: Support creating, versioning, and publishing policies. Published policies are immutable, and only one version is active at a time.
- [ ] **DSL-01 (Safe Policy DSL)**: Support a human-readable, text-based DSL for defining multi-stage approval rules.
- [ ] **ENG-01 (Safe DSL Interpreter)**: Implement a completely deterministic, safe DSL parser and evaluation engine in Pure TypeScript (NO `eval()` or dynamic execution).
- [ ] **REQ-01 (Request Submission)**: Allow users to submit requests containing dynamic context payloads.
- [ ] **EVL-01 (Approval Generation)**: Evaluate submitted requests against the active policy to dynamically generate approval chains and tasks.
- [ ] **AUD-01 (Audit Logging Foundation)**: Establish foundational AuditLog schema and domain entities in Phase 1 to track policy publication, approval history, and governance records.
- [ ] **UI-01 (Admin and User Portal)**: Provide a React-based UI featuring a Monaco-based Policy Editor, request forms, and a personal approval inbox.

### Out of Scope

- **Payroll, Attendance, & Recruitment** — HR-specific features are explicitly out of scope. The platform must remain domain-neutral.
- **Microservices & CQRS** — Out of scope. We will keep the architecture simple, boring, and consolidated.
- **Workflow & Visual Builders** — Out of scope for MVP. Focus purely on text-based DSL execution.

## Context

We are building a highly decoupled, modular policy engine. To guarantee extreme maintainability and prevent domain leaks, we are utilizing **Hexagonal Architecture (Ports & Adapters)** in a **Modular Monolith** style.
- **Domain Layer**: Contains the core logic of the Policy Engine, dynamic parser, and foundational entities (Tenant, User, Role, AuditLog) in Pure TS. Completely isolated.
- **Application Layer**: Contains services executing actions and orchestrating business logic, communicating through Ports.
- **Adapter Layer**: Implements persistence and communication adapters (Convex).

## Constraints

- **Domain-Neutrality Constraint**: The core platform must remain 100% domain-neutral. No HR-specific static code, role enums, or business primitives are allowed in the core domain.
- **Architecture Constraint**: Absolute adherence to Modular Monolith + Hexagonal Architecture (Ports & Adapters). No cross-importing between modules at Adapters/Application level.
- **Testing Constraint**: 100% test coverage for the Policy Engine (DSL interpreter), Policy Versioning, and Approval Generation. 90%+ coverage on all critical business logic.
- **Security Constraint**: No usage of `eval()` or dynamic JS/TS code generation. The DSL interpreter must be a deterministic parser.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Dynamic Role Model | Hardcoding roles in enums limits the platform to HR. Treating roles as tenant configuration data enables multi-domain flexibility. | — Pending |
| Foundational AuditLog | Policy governance requires strict auditability. Establishing an AuditLog skeleton in Phase 1 ensures tracing is designed-in. | — Pending |

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
