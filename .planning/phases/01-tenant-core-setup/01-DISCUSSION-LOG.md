# Phase 1: Tenant & Core Data Model Setup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 01-tenant-core-setup
**Areas discussed:** Domain Neutrality & Decoupled Roles, Multi-Tenancy Isolation, Reporting Lines, Audit Log Foundation

---

## Domain Neutrality & Decoupled Roles

| Option | Description | Selected |
|--------|-------------|----------|
| Static Role Enum | Hardcode employee, manager, hr_head, ceo roles as a code enum. | |
| Dynamic Data-Driven Roles | Create `RoleEntity` and `Role` schema to represent dynamic, tenant-configured roles (e.g. receptionist, supervisor, monk). | ✓ |

**User's choice:** Dynamic Data-Driven Roles (data, not code).
**Notes:** Decouples core platform from HR-specific limitations, allowing multi-domain compatibility (hotels, temples, contractors).

---

## Multi-Tenancy Isolation

| Option | Description | Selected |
|--------|-------------|----------|
| Single Database + Tenant ID | Logical isolation via a `tenantId` field on all documents. Standard, highly cost-effective. | ✓ |
| Database-per-tenant | Physical database separation. Extremely secure, but high complexity and infrastructure overhead. | |

**User's choice:** Single Database + Tenant ID (Logical separation).
**Notes:** Fits best for early validation and startup MVP speed.

---

## Reporting Lines

| Option | Description | Selected |
|--------|-------------|----------|
| Simple reporting link | direct `managerId` field pointing to another User in the same Tenant. | ✓ |
| Dedicated Reporting Table | Dedicated table mapping hierarchy and history. | |

**User's choice:** Simple reporting link.
**Notes:** Simple, dynamic supervisor tree structure is highly domain-neutral.

---

## Audit Log Foundation

| Option | Description | Selected |
|--------|-------------|----------|
| Postponed | Defer all AuditLog work to Phase 6. | |
| Foundational Skeleton | Introduce `AuditLogEntity` domain model skeleton and schema in Phase 1 without service implementation. | ✓ |

**User's choice:** Foundational Skeleton in Phase 1.
**Notes:** Essential for governance tracing, establishing the database entity layout early.

---

## the agent's Discretion

- Exact method signatures in Port interfaces.
- Testing mock configurations and Vitest boilerplate setup.
- Helper scripts for bootstrapping database fields.

## Deferred Ideas

- Full AuditLog persistence flow — Phase 6.

---

*Phase: 01-tenant-core-setup*
*Discussion log generated: 2026-05-31*
