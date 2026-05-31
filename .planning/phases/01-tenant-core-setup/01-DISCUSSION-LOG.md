# Phase 1: Tenant & Core Data Model Setup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 01-tenant-core-setup
**Areas discussed:** Database & ORM Adapter, Multi-Tenancy Isolation, Reporting Lines

---

## Database & ORM Adapter

| Option | Description | Selected |
|--------|-------------|----------|
| Hexagonal Ports with Prisma Adapter | Standard relational databases (PostgreSQL/MySQL) using Prisma ORM. | |
| Hexagonal Ports with Convex Adapter | Real-time serverless document database (Convex) specified in the original brief. | ✓ |

**User's choice:** Hexagonal Ports with Convex Adapter.
**Notes:** Decoupled Hexagonal structure allows core logic to stay pure TS, making database adapters interchangeable.

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
**Notes:** Keep it simple for the MVP to avoid complex org-graph database query overhead.

---

## the agent's Discretion

- Exact method signatures in Port interfaces.
- Testing mock configurations and Vitest boilerplate setup.
- Helper scripts for bootstrapping database fields.

## Deferred Ideas

- None — discussion stayed within phase scope.

---

*Phase: 01-tenant-core-setup*
*Discussion log generated: 2026-05-31*
