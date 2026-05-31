# Phase 1: Tenant & Core Data Model Setup - Research

**Researched:** 2026-05-31
**Domain:** Multi-Tenant Hexagonal Architecture using Convex Database & Vitest
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01**: The platform must remain 100% domain-neutral. No HR-specific static code, role enums, or HR-only business assumptions are allowed. Leave requests are purely a demonstration workflow.
- **D-02**: Roles are completely data-driven (data, not code). A `RoleEntity` represents tenant-defined roles (e.g. Receptionist, Monk, CEO).
- **D-03**: Users are linked to dynamic roles via a stable identifier **`roleId`** referencing the `RoleEntity.id` (not the name string) to ensure references remain consistent if a role is renamed.
- **D-04**: Separate role management and user management into distinct, highly focused application services: `RoleService` and `UserService`.
- **D-05**: Place lightweight **`PolicyEntity`** and **`PolicyVersionEntity`** skeletons in the core domain in Phase 1 (no schemas, persistence, or services yet) to prevent future breaking domain refactors.
- **D-06**: Direct manager/reporting supervisor relations are tracked dynamically using a simple `managerId` field pointing to another User ID within the same Tenant.
- **D-07**: Introduce a basic `AuditLogEntity` domain skeleton in Phase 1 (no service implementation needed yet).

### the agent's Discretion
- Exact method signatures in Port interfaces.
- Testing mock configurations and Vitest boilerplate setup.

### Deferred Ideas (OUT OF SCOPE)
- Full AuditLog persistence flow — Phase 6. Only the domain entity is created in Phase 1.
- Policy & PolicyVersion persistence and services — Phase 3. Only domain skeletons exist in Phase 1.

</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tenant & Role CRUD operations | API/Backend (Convex RPC) | Database/Storage | Handled through mutation/query RPC endpoints calling separated services |
| User registrations with roleId validation | API/Backend | Database/Storage | UserService queries RoleRepositoryPort to verify roleId is valid for the tenant |
| Policy & PolicyVersion foundations | Domain (Pure TS) | — | Skeletons declared in domain to establish core entities early |
| Data isolation checks | Application Layer | Database/Storage | Every database fetch/write enforces logical `tenantId` checking via repository ports |
| Unit testing coverage | Local/CLI (Vitest) | — | Decoupled Ports allow full test doubles in Vitest without running Convex |

</architectural_responsibility_map>

<research_summary>
## Summary

This research establishes a strict **Hexagonal Architecture (Ports & Adapters)** Monolith with complete domain neutrality using **Convex**. By keeping roles, reporting paths, and policies as data configurations in the database instead of code, the engine handles any domain structure.

To ensure long-term correctness and prevent domain leaks:
1. Users reference dynamic roles via a stable, unique **`roleId`** string pointing to `RoleEntity.id`, rather than role name strings. This keeps user linkages stable even if roles are renamed.
2. We enforce Single Responsibility by separating **`RoleService`** (role CRUD and naming) from **`UserService`** (user profiles and reporting structures).
3. We introduce **`PolicyEntity`** and **`PolicyVersionEntity`** domain skeletons in Phase 1, making them first-class domain citizens.
4. Convex query/mutation transaction frames (`ctx.db`) are passed to the Repository Adapters inside Convex RPC entry points.
5. Non-serverless Vitest unit tests use TS mock repositories for 100% test coverage.

**Primary recommendation:** Register the dynamic `roles` table in Convex and verify `roleId` linkages inside `UserService` using the `RoleRepositoryPort` before registering users.

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
        │   ├── entities.ts     # Pure TS Entities (Tenant, User, Role, Policy, PolicyVersion, AuditLog)
        │   └── types.ts        # Pure TS Types
        ├── ports/
        │   ├── tenant.repository.port.ts
        │   ├── role.repository.port.ts
        │   └── user.repository.port.ts
        ├── application/
        │   ├── tenant.service.ts
        │   ├── role.service.ts # Dedicated RoleService (register, rename, list)
        │   ├── user.service.ts # Dedicated UserService (register, assign, report)
        │   ├── dtos.ts         # Data Transfer Objects
        │   └── user.service.spec.ts  # Vitest unit tests (100% coverage)
        └── adapters/
            └── database/
                ├── convex-tenant.repository.ts
                ├── convex-role.repository.ts
                └── convex-user.repository.ts
```

### Pattern 1: Pure Domain Modeling & Stable roleId Links
Users reference dynamic roles via a stable `roleId` pointing to `RoleEntity.id`.
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
  public readonly roleId: string; // Stable reference to RoleEntity.id
  public readonly managerId?: string; // Parent supervisor reports-to link

  constructor(props: {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    roleId: string;
    managerId?: string;
  }) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.email = props.email;
    this.roleId = props.roleId;
    this.managerId = props.managerId;
  }
}
```

### Pattern 2: First-Class Policy Skeletons
`PolicyEntity` and `PolicyVersionEntity` are declared in Phase 1 to lay the conceptual foundation for future policy compiled runs.
```typescript
// src/modules/tenant/domain/entities.ts (continued)
export class PolicyEntity {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly name: string;

  constructor(props: { id: string; tenantId: string; name: string }) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
  }
}

export class PolicyVersionEntity {
  public readonly id: string;
  public readonly policyId: string;
  public readonly version: number;
  public readonly content: string;
  public readonly status: string; // "draft" | "active" | "archived"

  constructor(props: {
    id: string;
    policyId: string;
    version: number;
    content: string;
    status: string;
  }) {
    this.id = props.id;
    this.policyId = props.policyId;
    this.version = props.version;
    this.content = props.content;
    this.status = props.status;
  }
}
```

</architecture_patterns>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Dynamic Role Name Coupling
**What goes wrong:** If roles are mapped directly by name strings (e.g. `role: "CEO"`), renaming the role to `"Chief Executive"` breaks query consistency and invalidates user associations.
**How to avoid:** Always map users to dynamic roles using a unique, immutable database ID (`roleId`), treating role names as editable display fields.

### Pitfall 2: UserService Bloat
**What goes wrong:** Building user registration, role creation, and role renaming inside `UserService` creates a single coalesced bloated service.
**How to avoid:** Strictly partition business operations into distinct `RoleService` and `UserService` files.

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
    roleId: v.string(), // stable identifier referencing roles._id
    managerId: v.optional(v.string()), // supervisor reports-to link
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
- Ecosystem: Hexagonal Architecture, separated services, Vitest.
- Patterns: ID-based roleId linkages, separated RoleService/UserService, Policy/PolicyVersion skeletons.

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
