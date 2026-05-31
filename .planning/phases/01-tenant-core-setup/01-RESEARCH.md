# Phase 1: Tenant & Core Data Model Setup - Research

**Researched:** 2026-05-31
**Domain:** Multi-Tenant Hexagonal Architecture using Convex Database & Vitest
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01**: Build all core business modules with Pure TS domain logic and strict Port interfaces. Implement persistence using a Convex Adapter, keeping Convex dependency isolated inside adapters/database layer.
- **D-02**: Convex RPC entry points act as adapters/rpc layer, passing requests to application services and returning results.
- **D-03**: Single database instance with logical data separation using a `tenantId` field present on all Convex database documents.
- **D-04**: Track reporting hierarchy by having a simple `managerId` field directly on the User entity pointing to another User in the same Tenant.
- **D-05**: User Roles are defined as a static TS enum: `employee`, `manager`, `hr_head`, `ceo`.
- **D-06**: Enforce Hexagonal Architecture structure: `domain/`, `ports/`, `application/`, `adapters/` in modular monograph structure.

### the agent's Discretion
- Exact method signatures in Port interfaces.
- Testing mock configurations and Vitest boilerplate setup.
- Helper scripts for bootstrapping database fields.

### Deferred Ideas (OUT OF SCOPE)
- Payroll, attendance tracking, and recruitment features are deferred to future milestones.

</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tenant CRUD operations | API/Backend (Convex RPC) | Database/Storage | Handled through mutation/query RPC endpoints calling application services |
| Direct reporting lines | Domain (Pure TS) | API/Backend | Hierarchy rules parsed dynamically from User entities |
| Data isolation checks | Application Layer | Database/Storage | Every database fetch/write enforces logical `tenantId` checking via repository ports |
| Unit testing coverage | Local/CLI (Vitest) | — | Decoupled Ports allow full test doubles in Vitest without running Convex |

</architectural_responsibility_map>

<research_summary>
## Summary

This research focuses on building a strict **Hexagonal Architecture (Ports & Adapters)** in a Nest-like modular monolith structure using **Convex** as the serverless persistence engine. Convex functions (queries and mutations) run in a serverless Node-like runtime and execute queries on a document database.

To follow the **Modular Monolith + Ports & Adapters** architecture strictly without database lock-in:
1. All core business rules, entities, and services reside in pure TypeScript modules (`src/modules/tenant`). They must have zero imports from `convex/server` or other platform-specific libraries.
2. Persistence contracts are defined as pure TypeScript Port interfaces in `ports/`.
3. The Convex Adapters in `adapters/database/` implement the repository ports by wrapping the Convex `ctx.db` database transactions.
4. The Convex API entry points (in the `convex/` directory) act as RPC Adapters. They receive calls, instantiate the adapters with Convex context, inject them into application services, and invoke the services.

**Primary recommendation:** Instantiate Repository Adapters inside each Convex function handler by passing the active transaction context (`ctx.db` or transaction writer) to the Adapter constructor, then execute business logic in pure, testable Application Services.

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

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure TS Mocks | convex-test | Convex-test is great for testing queries/mutations, but pure TS in-memory repository mocks allow 100% pure unit testing of Domain/Application logic, independent of Convex completely. |

**Installation:**
```bash
npm install convex
npm install -D vitest @types/node typescript
```

</standard_stack>

<architecture_patterns>
## Architecture Patterns

### System Architecture Diagram
```
[Client App] --(RPC Network)--> [Convex Functions] (rpc-adapter)
                                        │
                                        ▼ (instantiates)
                                 [TenantService] (application)
                                        │
                                        ▼ (invokes port)
                           [UserRepositoryPort] (port interface)
                                        │
                                        ▼ (implemented by)
                         [ConvexUserRepository] (database-adapter)
                                        │
                                        ▼ (reads/writes)
                               [Convex Database] (ctx.db)
```

### Recommended Project Structure
```
convex/
├── schema.ts                   # Convex document schema definition
├── tenants.ts                  # Convex RPC endpoints (acting as adapters)
├── users.ts
src/
└── modules/
    └── tenant/
        ├── domain/
        │   ├── entities.ts     # Pure TS Entities (Tenant, User)
        │   └── types.ts        # TS Roles Enum & Type Guards
        ├── ports/
        │   ├── tenant.repository.port.ts
        │   └── user.repository.port.ts
        ├── application/
        │   ├── tenant.service.ts
        │   ├── user.service.ts
        │   ├── dtos.ts         # Data Transfer Objects
        │   └── tenant.service.spec.ts  # Vitest unit tests (100% coverage)
        └── adapters/
            └── database/
                ├── convex-tenant.repository.ts # Implements port via Convex
                └── convex-user.repository.ts
```

### Pattern 1: Pure Domain Entity Mapping
Keep entities pure and completely decoupled from database metadata (such as Convex's `_id` and `_creationTime`).
```typescript
// src/modules/tenant/domain/entities.ts
export class UserEntity {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly name: string;
  public readonly email: string;
  public readonly role: string;
  public readonly managerId?: string;

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

### Pattern 2: Context Injection in Serverless Adapters
Pass the Convex database context (`ctx.db` or transaction writer) to the Adapter class during RPC handler setup.
```typescript
// src/modules/tenant/adapters/database/convex-user.repository.ts
import { UserRepositoryPort } from "../../ports/user.repository.port";
import { UserEntity } from "../../domain/entities";

export class ConvexUserRepository implements UserRepositoryPort {
  // Receives Convex database context (either query or mutation db)
  constructor(private readonly db: any) {}

  async findById(id: string): Promise<UserEntity | null> {
    const doc = await this.db.get(id);
    if (!doc) return null;
    return new UserEntity({
      id: doc._id,
      tenantId: doc.tenantId,
      name: doc.name,
      email: doc.email,
      role: doc.role,
      managerId: doc.managerId,
    });
  }
}
```

### Anti-Patterns to Avoid
- **Platform Coupling**: Importing Convex packages (`convex/server`) inside the `domain` or `application` directories. This leaks infrastructure details and makes unit testing complex.
- **Dynamic Eval**: Using `eval()` or `Function()` for evaluating business rules. We must build a deterministic compiler and interpreter for the DSL in Phase 2.
- **Direct Database Mutation in Handlers**: Writing queries or document inserts directly inside Convex RPC files instead of delegating to domain-specific Application Services.

</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-time React reactivity | Custom polling or WebSocket listeners | Convex `useQuery` | Built-in, high-efficiency caching, and transaction-reactive synchronization. |
| Unique Document IDs | Incremental counter database math | Convex system generated `_id` | Distributed ID safety and immediate index performance. |

</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Serverless Cold Start Leaks
**What goes wrong:** Repeated instantiation of heavy dependencies slows down response times.
**Why it happens:** Serverless functions are stateless, recreating dependencies on every execution.
**How to avoid:** Keep Application Services and Domain Entities lightweight. Ensure adapters only map pure data types and do not instantiate heavy external runtimes.

### Pitfall 2: Direct Model Exposure
**What goes wrong:** Leaking internal Convex metadata (`_id`, `_creationTime`) into the React client or frontend modules.
**Why it happens:** Passing database document results directly to the UI without mapping to Domain Entities.
**How to avoid:** Always map Convex documents to clean TS `UserEntity` or standard Application DTOs (`dtos.ts`) in the repository adapter before sending them back.

</common_pitfalls>

<code_examples>
## Code Examples

### Defining clean Convex Schema
```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tenants: defineTable({
    name: v.string(),
  }),
  users: defineTable({
    tenantId: v.string(), // logical isolation
    name: v.string(),
    email: v.string(),
    role: v.string(), // employee, manager, hr_head, ceo
    managerId: v.optional(v.string()), // reports-to reporting link
  }).index("by_tenant", ["tenantId"]),
});
```

### Convex RPC Handler acting as Hexagonal Adapter
```typescript
// convex/users.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexUserRepository } from "../src/modules/tenant/adapters/database/convex-user.repository";
import { UserService } from "../src/modules/tenant/application/user.service";

export const createUser = mutation({
  args: {
    tenantId: v.string(),
    name: v.string(),
    email: v.string(),
    role: v.string(),
    managerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Instantiate Convex Adapter with db transaction context
    const userRepository = new ConvexUserRepository(ctx.db);
    
    // 2. Instantiate Application Service
    const userService = new UserService(userRepository);
    
    // 3. Execute request through the Application layer
    return await userService.registerUser(args);
  },
});
```

</code_examples>

<sota_updates>
## State of the Art (2024-2025)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fat RPC Handlers containing SQL/NoSQL statements | Lean RPC Wrappers orchestrating pure TS Application Services | 2023+ | Clean architectural separation, enabling testability in non-serverless runtimes. |
| In-browser validation | Unified Type Guards inside Domain Entities | 2024 | Prevents data corruption across API and storage boundaries. |

</sota_updates>

<open_questions>
## Open Questions

1. **How should we handle direct database indexes in Convex since Convex is NoSQL?**
   - *What we know:* Convex indexes are defined statically in `schema.ts` (e.g. `.index("by_tenant", ["tenantId"])`).
   - *What is unclear:* How the pure TS repository port can communicate abstract index requirements to the Convex adapter without hardcoding platform details.
   - *Recommendation:* Keep port methods high-level (e.g., `findByTenant(tenantId)`), and implement the specific Convex index scan inside the Convex adapter using `db.query("users").withIndex("by_tenant", q => q.eq("tenantId", tenantId))` directly.

</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- Convex Official Documentation (schema definitions, mutations, serverless execution parameters).
- Clean Architecture / Hexagonal Architecture Monograph (Ports & Adapters standards).

### Secondary (MEDIUM confidence)
- Vitest testing benchmarks for TypeScript.

</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Convex serverless, TypeScript domain entities.
- Ecosystem: Hexagonal Architecture, modular monoliths, Vitest.
- Patterns: Adapter injection, logical tenant separation, reporting hierarchy.
- Pitfalls: Platform coupling, direct model leakage.

**Confidence breakdown:**
- Standard stack: HIGH - Convex and TypeScript are extremely mature and highly integrated.
- Architecture: HIGH - Monograph Hexagonal rules apply perfectly to serverless.
- Pitfalls: HIGH - Documented architectural rules.

**Research date:** 2026-05-31
**Valid until:** 2026-06-30
</metadata>

---

*Phase: 01-tenant-core-setup*
*Research completed: 2026-05-31*
*Ready for planning: yes*
