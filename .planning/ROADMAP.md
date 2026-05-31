# Roadmap: Mini-stry (Policy Runtime Platform)

## Overview

Mini-stry's development journey begins at the absolute core of the product: building a secure, deterministic, pure-TypeScript Lexer, Parser, and AST Interpreter to compile and execute policy DSL rules. Once the core engine is proven, we construct the versioning ledger and the dynamic approval generation logic. Only then do we layer in the supporting directory context providers (Tenants, Users, dynamic ID-based Roles, reports-to supervisors) and implement a secure audit logging layer. Finally, we deliver a premium Monaco-based React portal.

## Phases

- [ ] **Phase 1: Safe Policy Runtime & DSL Parser** - Build a safe, deterministic, pure-TypeScript Lexer, Parser, and AST Interpreter, verified against mock context payloads with 100% Vitest coverage.
- [ ] **Phase 2: Policy Versioning & Publishing Ledger** - Develop the policy creation, immutable version increments upon publishing, active-version tracking, and rollback operations.
- [ ] **Phase 3: Decision & Approval Generation** - Dynamic approval task tree and sequential chain construction resolved from evaluation AST decision nodes.
- [ ] **Phase 4: Multi-Tenant Context & Directory Providers** - Database schema and dynamic directory adapters (Tenants, Users, dynamic roleId links, and managerId supervisors) as supporting context providers.
- [ ] **Phase 5: Audit Logging & Tracing** - Record immutable execution audit logs for policy changes and approval transaction tracks.
- [ ] **Phase 6: Frontend Monaco Editor & UI Dashboards** - React portal with Monaco DSL editor, request submission, and manager approval inbox.

---

## Phase Details

### Phase 1: Safe Policy Runtime & DSL Parser
**Goal**: Build a highly tested, secure, and completely deterministic Lexer, Parser, and AST Interpreter in pure TypeScript to compile rules and evaluate outcomes without using `eval()`.
**Depends on**: Nothing (first phase)
**Requirements**: POL-05, POL-06, RUN-02, AUD-03
**Success Criteria**:
  1. Base modular directory structure is established under Hexagonal Architecture rules.
  2. Lexer tokenizes a policy file with conditional expressions.
  3. AST Parser builds clean, structured rule representations.
  4. Interpreter evaluates rules correctly against dynamic payloads and returns predicted decisions.
  5. Policy engine unit tests achieve 100% code coverage.
**Plans**: 3 plans

Plans:
- [ ] 01-01: Configure Typescript environment, Vitest, and create the baseline Monolith-Hexagonal directory structure with domain entities (Tenant, User, Role, Policy, PolicyVersion, AuditLog).
- [ ] 01-02: Implement the lexical scanner (Lexer) and AST Parser for the custom policy DSL syntax.
- [ ] 01-03: Implement the safe, deterministic evaluation Interpreter (evaluator) in pure TS, verified by 100% test coverage in Vitest.

### Phase 2: Policy Versioning & Publishing Ledger
**Goal**: Develop the policy pipeline that compiles the DSL and guarantees version immutability upon publishing.
**Depends on**: Phase 1
**Requirements**: POL-01, POL-02, POL-03, POL-04
**Success Criteria**:
  1. Creating and publishing a policy compiles the DSL and increments versions cleanly.
  2. Modifying a published policy throws an explicit error, guaranteeing immutability.
  3. Rollback operations restore previous active versions instantly.
**Plans**: 2 plans
- [ ] 02-01: Implement policy drafts, compilation validation, and immutable publishing flows.
- [ ] 02-02: Implement active-state activation, rollback mechanics, and repository port operations.

### Phase 3: Decision & Approval Generation
**Goal**: Process dynamic request payloads against active policies to dynamically generate structured decisions and sequential approval tasks.
**Depends on**: Phase 2
**Requirements**: DEC-01, DEC-02, DEC-03
**Success Criteria**:
  1. Evaluating requests evaluates active DSL rules and outputs decision nodes (e.g. Auto-Approve vs task generation).
  2. Generates sequential Approval Tasks (Step 1 must be approved before Step 2 opens).
  3. Approve/Reject decisions trigger clean state machine transitions.
**Plans**: 2 plans
- [ ] 03-01: Implement Request Domain entities and evaluation orchestrator.
- [ ] 03-02: Implement sequential approval task chain generation and decision state machine.

### Phase 4: Multi-Tenant Context & Directory Providers
**Goal**: Build database schema, dynamic role mappings, and user directories to feed context variables into the runtime.
**Depends on**: Phase 3
**Requirements**: CON-01, CON-02, CON-03, CON-04
**Success Criteria**:
  1. Convex Schema defines Tenants, Users (linked via roleId), dynamic Roles, and AuditLogs.
  2. UserService and RoleService are decoupled and enforce single responsibility.
  3. Dynamic roleId references keep user linkages stable if roles are renamed.
**Plans**: 3 plans
- [ ] 04-01: Implement Convex database schema, logical multi-tenant indices, and repository ports.
- [ ] 04-02: Implement decoupled RoleService and UserService application layers.
- [ ] 04-03: Implement Convex database adapters and verify dynamic roleId/reports-to validations with tests.

### Phase 5: Audit Logging & Tracing
**Goal**: Hook immutable transaction audit logs into policy publications, compilations, and approval decisions.
**Depends on**: Phase 4
**Requirements**: AUD-01, AUD-02, AUD-03
**Success Criteria**:
  1. Logs secure ledger entries for all policy activation updates.
  2. Logs every request evaluation detail, storing the exact AST decision path.
**Plans**: 2 plans
- [ ] 05-01: Implement AuditLog domain port and middleware trackers.
- [ ] 05-02: Implement Convex database adapters for audit logging and verify integration.

### Phase 6: Frontend Monaco Editor & UI Dashboards
**Goal**: Build a stunning, dark-mode React client featuring a Monaco DSL editor, submission forms, and a manager approval inbox.
**Depends on**: Phase 5
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria**:
  1. Premium, animated React portal wowing the user.
  2. Admin writes DSL policies inside Monaco Editor with real-time compilation checks.
  3. Personal inbox displays pending tasks with transparent decision trails.
**Plans**: 4 plans
- [ ] 06-01: Bootstrap React routing, layout, and TailwindCSS theme tokens.
- [ ] 06-02: Integrate Monaco Editor with live syntax check panel.
- [ ] 06-03: Build request logs, dynamic forms, and approval dashboards.
- [ ] 06-04: Build governance timeline viewer for audit logs.

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Safe Policy Runtime & DSL Parser | 0/3 | Not started | - |
| 2. Policy Versioning & Publishing | 0/2 | Not started | - |
| 3. Decision & Approval Generation | 0/2 | Not started | - |
| 4. Multi-Tenant Context & Directories | 0/3 | Not started | - |
| 5. Audit Logging & Tracing | 0/2 | Not started | - |
| 6. Frontend Monaco Editor & UI | 0/4 | Not started | - |
