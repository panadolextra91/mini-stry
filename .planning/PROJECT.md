# Project: Mini-stry

## What This Is

Mini-stry is a multi-tenant, domain-agnostic policy engine that allows organizations (tenants) to define their own business rules and approval workflows dynamically. Instead of hardcoding business rules (like HR leave policies), the platform's behavior is driven entirely by custom policies written in a human-readable, text-based DSL. The first domain use case is employee leave approval.

## Core Value

Empowers organizations to dynamically define, version, and execute custom business rules and multi-stage approval workflows without hardcoding domain-specific logic.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **SYS-01 (Multi-Tenancy)**: Support isolated data, users, and roles (employee, manager, hr_head, ceo) across multiple tenants.
- [ ] **POL-01 (Policy Versioning & Publishing)**: Support creating, versioning, and publishing policies. Published policies are immutable, and only one version is active at a time.
- [ ] **DSL-01 (Safe Policy DSL)**: Support a human-readable, text-based DSL for defining multi-stage approval rules.
- [ ] **ENG-01 (Safe DSL Interpreter)**: Implement a completely deterministic, safe DSL parser and evaluation engine in Pure TypeScript (NO `eval()` or dynamic execution).
- [ ] **REQ-01 (Request Submission)**: Allow users to submit requests (e.g. leave requests) that capture input context (e.g. number of days).
- [ ] **EVL-01 (Approval Generation)**: Evaluate submitted requests against the active policy to dynamically generate approval chains and tasks for designated approvers.
- [ ] **AUD-01 (Audit Logging)**: Track all policy publications, version changes, and approval task decisions (approve/reject/delegate) in a secure audit log.
- [ ] **UI-01 (Admin and User Portal)**: Provide a React-based UI featuring a Monaco-based Policy Editor with live validation, request forms, and a personal approval inbox.

### Out of Scope

- **Payroll and Attendance** — Out of scope for MVP to keep implementation focused on the core policy engine.
- **Recruitment & Performance Review** — Out of scope; defer to future milestones.
- **Dynamic Org Chart Generation** — Manager-employee reporting lines will be simple relationships in the database, avoiding complex graph computation for the MVP.
- **Advanced Code Execution** — Canned dynamic script execution is prohibited due to security and reliability guidelines.

## Context

We are building a highly decoupled, modular policy engine. To guarantee extreme maintainability and prevent domain leaks, we are utilizing **Hexagonal Architecture (Ports & Adapters)** in a **Modular Monolith** style.
- **Domain Layer**: Contains the core logic of the Policy Engine and parser (Pure TS). Completely isolated.
- **Application Layer**: Contains services executing actions and orchestrating business logic, communicating through Ports.
- **Adapter Layer**: Implements persistence and communication adapters.
We will build pure TypeScript repository ports, ensuring that the backend can be implemented using Convex or Prisma as interchangeable adapters without changing a single line of business logic.

## Constraints

- **Architecture Constraint**: Absolute adherence to Modular Monolith + Hexagonal Architecture (Ports & Adapters). No cross-importing between modules at Adapters/Application level.
- **Testing Constraint**: 100% test coverage for the Policy Engine (DSL interpreter), Policy Versioning, and Approval Generation. 90%+ coverage on all critical business logic.
- **ORM / Database**: Prisma / Convex. Adapters must implement clean Repository Ports.
- **Security Constraint**: No usage of `eval()` or dynamic JS/TS code generation. The DSL interpreter must be a deterministic parser.
- **Consulting Rule**: Always filter `requiresPrescription: false` for Consultant flows (as per global rule specifics).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pure Decoupled Parser | Using `eval()` violates security rules. We will build a recursive descent parser or simple scanner for our custom DSL. | — Pending |
| Repository Port Pattern | Decouples persistence (Prisma or Convex) from the core policy engine, allowing zero-friction DB swaps. | — Pending |
| Immutable Versioning | Ensures historical request audits are 100% accurate even if policies are updated or rolled back. | — Pending |

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
