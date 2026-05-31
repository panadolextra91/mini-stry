# Phase 1: Safe Policy Runtime & DSL Parser - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a safe, deterministic, pure-TypeScript Lexer, AST Parser, and Interpreter to compile and evaluate DSL rules against mock context payloads without using dynamic code execution (`eval()`). Establish the modular monolithic folder layout and foundational domain entities in the `src/modules/policy` module.

</domain>

<decisions>
## Implementation Decisions

### Domain Neutrality & Priority
- **D-01**: Policies, versions, and runtime are first-class primitives. User directories and role contexts exist strictly as supporting inputs to feed evaluation transactions.
- **D-02**: All business rules and compiler modules must stay domain-neutral. Leave requests are only a mock test case.

### Secure Non-Eval DSL Engine
- **D-03**: Strict ban on dynamic `eval()`, `Function()`, or dynamic script tags. The DSL engine must implement a deterministic, recursive descent AST compiler and interpreter in Pure TS, guaranteeing 100% safety and predictability.
- **D-04**: The custom DSL syntax supports:
  - Policy metadata (name, applies_for)
  - Sequential Rule arrays (`rules: if [condition] approve_by [role]`)
  - Basic comparisons (`<=`, `>`, `==`) and variable lookups.

### First-Class Policy Skeletons
- **D-05**: Register foundational domain entity skeletons inside Phase 1:
  - `PolicyEntity` (id, tenantId, name)
  - `PolicyVersionEntity` (id, policyId, version, content, status)
  - `AuditLogEntity` (id, tenantId, actorId, action, targetType, targetId, details, timestamp)
  - `TenantEntity` (id, name)
  - `UserEntity` (id, tenantId, name, email, roleId, managerId)
  - `RoleEntity` (id, tenantId, name)

### Hexagonal Folder Structure
- **D-06**: Establish `policy` modular hexagonal architecture folder layout:
  ```
  src/
    modules/
      policy/
        domain/
          entities.ts       <- Core entities (Policy, PolicyVersion, Tenant, User, Role, AuditLog skeletons)
          types.ts          <- AST and token interfaces
          lexer.ts          <- Tokenizes raw DSL strings
          parser.ts         <- Generates AST representing rules
          interpreter.ts    <- Evaluates AST against dynamic context payloads
        ports/
          policy-runtime.port.ts
        application/
          policy-runtime.service.ts      <- Orchestrates policy compilations and runs
          policy-runtime.service.spec.ts  <- Vitest testing suite
  ```

### the agent's Discretion
- Exact Lexer tokens naming conventions.
- AST data structure properties (JSON representation).
- Vitest mock fixtures definitions.

</decisions>

<specifics>
## Specific Ideas

- Leave approvals are represented purely as mock payload fixtures inside the test files, ensuring the engine compiles and parses any generic rule format seamlessly.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Vision & Specifications
- `docs/idea.md` — Policy Engine core values, Monaco editor specifications, human-readable DSL concept, and 2-week MVP roadmap.
- `docs/engineering.md` — Strict Vitest code coverage targets (100% on AST engine, 90%+ critical paths), TypeScript strict configurations, and dynamic-eval bans.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None (Greenfield codebase).

### Established Patterns
- Modular Monolith + Hexagonal Architecture standard defined in `EXECUTE_RULE.MD`.

### Integration Points
- This Phase 1 core runtime will be imported and bound to Convex persistence adapters and user directory providers in future phases.

</code_context>

<deferred>
## Deferred Ideas

- Policy versioning persistence adapters and Convex schema mapping — Phase 2.
- Multi-Tenant directory adapters, User databases, and RoleServices — Phase 4.
- Full Audit log execution middleware — Phase 5.

</deferred>

---

*Phase: 01-safe-policy-runtime*
*Context gathered: 2026-05-31*
