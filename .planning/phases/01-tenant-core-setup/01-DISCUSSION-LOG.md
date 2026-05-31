# Phase 1: Tenant & Core Data Model Setup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 01-tenant-core-setup
**Areas discussed:** Domain Neutrality & decoupled Role linkage, Multi-Tenancy Isolation, Reporting Lines, Service Responsibilities, Policy Foundations, Audit Log Foundation

---

## Domain Neutrality & Decoupled Role Linkage

| Option | Description | Selected |
|--------|-------------|----------|
| User.role: string | Link user directly to role name string (e.g. role: "Manager"). coupling user to role renames. | |
| User.roleId: string | Link user via a stable `roleId` referencing the dynamic `RoleEntity.id` (data, not code). | ✓ |

**User's choice:** Stable `roleId` referencing dynamic Role ID.
**Notes:** Prevents user references from breaking when a role name is updated/re-labeled by the tenant.

---

## Service Responsibilities

| Option | Description | Selected |
|--------|-------------|----------|
| Coalesced UserService | Handle role registration, role renaming, and user setups all inside `UserService`. | |
| Separated Services | Dedicated `RoleService` (registerRole, renameRole, listRoles) and `UserService` (registerUser, assignRole, reporting). | ✓ |

**User's choice:** Dedicated, separated `RoleService` and `UserService`.
**Notes:** Adheres strictly to Single Responsibility, avoiding high coupling inside `UserService`.

---

## Policy Foundations

| Option | Description | Selected |
|--------|-------------|----------|
| Postponed | Defer policy modeling completely to Phase 3. | |
| Phase 1 Domain Skeletons | Introduce `PolicyEntity` and `PolicyVersionEntity` skeletons in domain layer in Phase 1 without databases schemas or services. | ✓ |

**User's choice:** Policy & PolicyVersion domain skeletons in Phase 1.
**Notes:** Prevents future breaking domain refactors and establishes policies as first-class citizens from the start.

---

## Multi-Tenancy Isolation

| Option | Description | Selected |
|--------|-------------|----------|
| Single Database + Tenant ID | Logical isolation via a `tenantId` field on all documents. Standard, highly cost-effective. | ✓ |
| Database-per-tenant | Physical database separation. Extremely secure, but high complexity and infrastructure overhead. | |

**User's choice:** Single Database + Tenant ID (Logical separation).

---

## Reporting Lines

| Option | Description | Selected |
|--------|-------------|----------|
| Simple reporting link | direct `managerId` field pointing to another User in the same Tenant. | ✓ |
| Dedicated Reporting Table | Dedicated table mapping hierarchy and history. | |

**User's choice:** Simple reporting link.

---

## Audit Log Foundation

| Option | Description | Selected |
|--------|-------------|----------|
| Postponed | Defer all AuditLog work to Phase 6. | |
| Foundational Skeleton | Introduce `AuditLogEntity` domain model skeleton and schema in Phase 1 without service implementation. | ✓ |

**User's choice:** Foundational Skeleton in Phase 1.

---

## the agent's Discretion

- Exact method signatures in Port interfaces.
- Testing mock configurations and Vitest boilerplate setup.

## Deferred Ideas

- Full AuditLog persistence flow — Phase 6.
- Full Policy & PolicyVersion persistence and services — Phase 3.

---

*Phase: 01-tenant-core-setup*
*Discussion log generated: 2026-05-31*
