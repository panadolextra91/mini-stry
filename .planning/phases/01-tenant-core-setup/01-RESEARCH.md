# Phase 1: Tenant & Core Data Model Setup - Research

**Researched:** 2026-05-31
**Domain:** Multi-Tenant Hexagonal Architecture using Convex Database & Vitest
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01**: The platform must remain 100% domain-neutral. No HR-specific static code, role enums, or HR-only business assumptions are allowed. Leave requests are purely a demonstration workflow.
- **D-02**: Roles are completely data-driven (data, not code). We will implement a `RoleEntity` representing tenant-defined roles (e.g. Receptionist, Monk, CEO). The `UserEntity` role property dynamically refers to a registered role string rather than a static TypeScript enum.
- **D-03**: Support dynamic role registering in the database, allowing each organization (tenant) to declare a custom hierarchy.
- **D-04**: Direct manager/reporting supervisor relations are tracked dynamically using a simple `managerId` field pointing to another User ID within the same Tenant, representing a generic tree structure.
- **D-05**: Introduce a basic `AuditLogEntity` domain skeleton in Phase 1 to lay the foundation for policy governance, publication tracking, and approval histories (no service implementation needed yet).
- **D-06**: Enforce strict Hexagonal Architecture structure: `domain/`, `ports/`, `application/`, `adapters/` in modular monograph structure.

### the agent's Discretion
- Exact method signatures in Port interfaces.
- Testing mock configurations and Vitest boilerplate setup.
- Helper scripts for bootstrapping database fields.

### Deferred Ideas (OUT OF SCOPE)
- Full AuditLog persistence flow — Phase 6. Only the domain entity is created in Phase 1.

</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tenant & Role CRUD operations | API/Backend (Convex RPC) | Database/Storage | Handled through mutation/query RPC endpoints calling application services |
| Data isolation checks | Application Layer | Database/Storage | Every database fetch/write enforces logical `tenantId` checking via repository ports |
| AuditLog schema registry | Database/Storage | Domain (Pure TS) | Basic skeleton registered in Convex schema and Domain entities for future governance |
| Unit testing coverage | Local/CLI (Vitest) | — | Decoupled Ports allow full test doubles in Vitest without running Convex |

</architectural_responsibility_map>

<research_summary>
## Summary

This research focuses on building a strict **Hexagonal Architecture (Ports & Adapters)** in a Nest-like modular monolith structure using **Convex** as the serverless database. The core theme of this platform is **absolute domain neutrality**: the system does not hardcode any roles (like employee, manager) or HR rules in code. Roles and organization structures are treated entirely as dynamic **data**, configured in the database per tenant.

To achieve complete domain neutrality and dynamic roles in Phase 1:
1. We define three tables in Convex: `tenants`, `roles`, and `users`. A user record has a `role` string which dynamically references a defined role within that tenant.
2. We establish the reporting supervisor tree by having a simple `managerId` field (acting as a generic reports-to link) on the `UserEntity`.
3. We define an `AuditLog` entity skeleton to track events.
4. Core business modules (`src/modules/tenant`) contain only pure TS code, completely isolated from Convex.
5. In-Memory mock repositories are used in Vitest to test services and domain flows with 100% code coverage.

**Primary recommendation:** Register the dynamic roles table in the database and represent `role` as a string parameter throughout the Domain and Application layers to ensure total architectural flexibility.

</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| convex | ^1.11.0 | Serverless Backend & Database | Selected real-time reactive persistence engine |
| typescript | ^5.0.0 | Static Typing | Required for pure TS enterprise domain modeling |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^1.5.0 | Test Runner | Primary business logic testing engine |
| typescript-eslint | ^7.0.0 | Static Code Linting | Enforces clean typing and code quality |

**Installation:**
```bash
npm install convex
npm install -D vitest @types/node typescript
```

</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
convex/
├── schema.ts                   # Convex document schema definition
├── tenants.ts                  # Convex RPC endpoints (acting as adapters)
├── roles.ts
├── users.ts
src/
└── modules/
    └── tenant/
        ├── domain/
        │   ├── entities.ts     # Pure TS Entities (Tenant, User, Role, AuditLog)
        │   └── types.ts        # Pure TS Types
        ├── ports/
        │   ├── tenant.repository.port.ts
        │   ├── role.repository.port.ts
        │   └── user.repository.port.ts
        ├── application/
        │   ├── tenant.service.ts
        │   ├── user.service.ts
        │   ├── dtos.ts         # Data Transfer Objects
        │   └── user.service.spec.ts  # Vitest unit tests (100% coverage)
        └── adapters/
            └── database/
                ├── convex-tenant.repository.ts
                ├── convex-role.repository.ts
                └── convex-user.repository.ts
```

### Pattern 1: Domain-Neutral Dynamic Roles
Keep roles entirely data-driven. The user's role is a string pointing to a registered Role entity.
```typescript
// src/modules/tenant/domain/entities.ts
export class RoleEntity {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly name: string;

  constructor(props: { id: string; tenantId: string; name: string }) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
  }
}

export class UserEntity {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly name: string;
  public readonly email: string;
  public readonly role: string; // Dynamic string matching RoleEntity.name
  public readonly managerId?: string; // Reports-to supervisor link

  constructor(props: {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    role: string;
    managerId?: string;
  }) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.email = props.email;
    this.role = props.role;
    this.managerId = props.managerId;
  }
}
```

### Pattern 2: AuditLog Domain Skeleton
A lightweight, immutable ledger skeleton declared inside the core domain.
```typescript
// src/modules/tenant/domain/entities.ts (continued)
export class AuditLogEntity {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly actorId: string;
  public readonly action: string;
  public readonly targetType: string; // e.g. "policy", "request", "role"
  public readonly targetId: string;
  public readonly details: string;
  public readonly timestamp: number;

  constructor(props: {
    id: string;
    tenantId: string;
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    details: string;
    timestamp: number;
  }) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.actorId = props.actorId;
    this.action = props.action;
    this.targetType = props.targetType;
    this.targetId = props.targetId;
    this.details = props.details;
    this.timestamp = props.timestamp;
  }
}
```

</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dynamic Role Authorization | Complex hardcoded state guards | Database metadata mapping | Data-driven configurations allow zero-downtime additions of new roles. |

</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Domain-leakage via Hardcoded Enums
**What goes wrong:** Restricting the platform to specific organization types (like HR) by writing static role enums (monk vs manager vs supervisor).
**Why it happens:** Attempting to hardcode domain convenience in typescript files.
**How to avoid:** Treat roles as records in the database. Read roles dynamically, and let the parser in Phase 2 handle validation at runtime.

</common_pitfalls>

<code_examples>
## Code Examples

### Defining clean, dynamic Convex Schema
```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tenants: defineTable({
    name: v.string(),
  }),
  roles: defineTable({
    tenantId: v.string(),
    name: v.string(),
  }).index("by_tenant", ["tenantId"]),
  users: defineTable({
    tenantId: v.string(), // logical isolation
    name: v.string(),
    email: v.string(),
    role: v.string(), // dynamic role string referencing roles.name
    managerId: v.optional(v.string()), // parent reporting supervisor link
  }).index("by_tenant", ["tenantId"]),
  auditLogs: defineTable({
    tenantId: v.string(),
    actorId: v.string(),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    details: v.string(),
    timestamp: v.number(),
  }).index("by_tenant", ["tenantId"]),
});
```

</code_examples>

<sources>
## Sources

### Primary (HIGH confidence)
- Convex Official Documentation.
- Ports & Adapters Hexagonal Design Principles.

</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Convex, TypeScript dynamic typings.
- Ecosystem: Hexagonal Architecture, modular monoliths, Vitest.
- Patterns: Dynamic data-driven roles, AuditLog skeleton, reports-to tree structure.

**Confidence breakdown:**
- Standard stack: HIGH
- Architecture: HIGH
- Pitfalls: HIGH

**Research date:** 2026-05-31
**Valid until:** 2026-06-30
</metadata>

---

*Phase: 01-tenant-core-setup*
*Research completed: 2026-05-31*
*Ready for planning: yes*
