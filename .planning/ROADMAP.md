# Roadmap: Mini-stry

## Overview

Mini-stry's journey begins by establishing a robust, multi-tenant database foundation. From there, we build the core of the product: a deterministic, safe, pure-TypeScript DSL parsing and interpretation engine. With the engine in place, we overlay policy versioning, dynamic request submission, and multi-stage approval chain generation. Finally, we implement immutable audit logs and deliver a premium React management portal integrated with Monaco Editor.

## Phases

- [ ] **Phase 1: Tenant & Core Data Model Setup** - Establish the core multi-tenant directory, user profiles, reporting structures, and database schema under Hexagonal Architecture rules.
- [ ] **Phase 2: Safe DSL Interpreter Engine** - Build a safe, deterministic Lexer, Parser, and AST Interpreter in pure TypeScript without using `eval()`.
- [ ] **Phase 3: Policy Versioning & Immutability** - Implement policy creation, immutable version increments upon publishing, active-version tracking, and rollback.
- [ ] **Phase 4: Request Submission & Policy Evaluation** - Core services to submit requests with dynamic payloads and run evaluations against the active policy.
- [ ] **Phase 5: Dynamic Approval Workflow Engine** - Generate multi-stage approval chains from evaluation outputs and process Approve/Reject task actions.
- [ ] **Phase 6: Audit Logging & Ledger** - Record immutable audit logs for policy version updates and step-by-step approval transitions.
- [ ] **Phase 7: Frontend Application & Monaco Editor** - React admin/user UI with a Monaco-based DSL editor, request dashboard, and manager inbox.

---

## Phase Details

### Phase 1: Tenant & Core Data Model Setup
**Goal**: Establish the core multi-tenant data structures, User, dynamic Role, and foundational AuditLog entities, reporting supervisor structures, and directories under Hexagonal Architecture.
**Depends on**: Nothing (first phase)
**Requirements**: SYS-01, SYS-02, SYS-03, SYS-04, AUD-03
**Success Criteria**:
  1. Multi-tenant database tables (including dynamic roles and audit logs) are registered in Convex schema.
  2. Subdirectory layout enforces Hexagonal Architecture with clear `adapters`, `application`, `domain`, and `ports` subfolders.
  3. TypeScript compilation passes, verifying 100% data-driven roles and basic AuditLog skeleton entities.
  4. Vitest testing environment runs successfully.
**Plans**: 3 plans
- [ ] 01-01: Configure Typescript environment, Vitest, and create the baseline Monolith-Hexagonal directory structure with domain models.
- [ ] 01-02: Create Convex Schema defining tenants, users, dynamic roles, policies, requests, tasks, and audit logs.
- [ ] 01-03: Implement core domain entities (Tenant, User, Role, AuditLog), Repository Ports, and Convex database adapters, fully covered by unit tests.

### Phase 2: Safe DSL Interpreter Engine
**Goal**: Build a highly tested, secure lexical scanner, parser, and interpreter in Pure TS to evaluate conditions and emit approval targets.
**Depends on**: Phase 1
**Requirements**: DSL-01, DSL-02, DSL-03
**Success Criteria**:
  1. Lexer successfully tokenizes a custom policy file with conditional expressions.
  2. Parser constructs a clean Abstract Syntax Tree (AST) representing rules.
  3. Interpreter evaluates rules correctly against dynamic payloads (e.g. `leave_days: 5`) and returns planned approval targets (e.g., manager, ceo).
  4. Policy engine unit tests achieve 100% coverage.
**Plans**: 3 plans
- [ ] 02-01: Create the lexical scanner (Lexer) and tokens list for the policy DSL.
- [ ] 02-02: Create the AST parser supporting rules, if-conditions, and approval targets.
- [ ] 02-03: Implement the deterministic evaluation interpreter, including error handlers and comprehensive test suite.

### Phase 3: Policy Versioning & Immutability
**Goal**: Develop the policy publishing pipeline that guarantees past versions remain completely immutable.
**Depends on**: Phase 2
**Requirements**: POL-01, POL-02, POL-03, POL-04
**Success Criteria**:
  1. Creating and publishing a policy compiles the DSL, validates semantic correctness, and increments version integers cleanly.
  2. Trying to edit a published version throws an explicit, user-friendly exception.
  3. Rolled-back versions restore as "active" immediately.
**Plans**: 2 plans
- [ ] 03-01: Implement policy draft, validation, and immutable publishing flow.
- [ ] 03-02: Implement active-state activation, rollback mechanics, and repository port operations.

### Phase 4: Request Submission & Policy Evaluation
**Goal**: Connect user request submissions with dynamic evaluation processes.
**Depends on**: Phase 3
**Requirements**: REQ-01, REQ-02, REQ-03
**Success Criteria**:
  1. Submitting a request stores metadata and parameters successfully.
  2. Submission invokes the correct active policy version, feeding parameters into the safe interpreter.
  3. Evaluation returns concrete approval roles/relationships without failure.
**Plans**: 2 plans
- [ ] 04-01: Implement Request Domain entities and Request submission services.
- [ ] 04-02: Build Request Evaluation orchestrator that runs active policy DSLs against submission payloads.

### Phase 5: Dynamic Approval Workflow Engine
**Goal**: Convert abstract policy targets (e.g. `manager`, `ceo`) to actual user assignments and resolve sequential task chains.
**Depends on**: Phase 4
**Requirements**: APP-01, APP-02, APP-03
**Success Criteria**:
  1. Converts relative targets like `manager` to specific user IDs using reporting lines.
  2. Generates sequential Approval Tasks (Step 1 must be approved before Step 2 opens).
  3. Approving all steps sets Request status to `approved`; rejecting any step terminates the flow and sets it to `rejected`.
**Plans**: 2 plans
- [ ] 05-01: Implement relative-to-absolute approver resolution and sequential chain generation.
- [ ] 05-02: Implement task decision actions (Approve, Reject) and request status transition state machine.

### Phase 6: Audit Logging & Ledger
**Goal**: Implement complete system and transaction audit logging to guarantee high-integrity operations.
**Depends on**: Phase 5
**Requirements**: AUD-01, AUD-02
**Success Criteria**:
  1. Every policy publication, activation, or rollback logs a secure audit entry.
  2. Every request evaluation and individual approval step documents the exact dynamic data and AST path selected.
**Plans**: 2 plans
- [ ] 06-01: Establish the Audit Log domain entity and core logging ports.
- [ ] 06-02: Hook logging middleware into policy, request, and task services to automatically capture trace paths.

### Phase 7: Frontend Application & Monaco Editor
**Goal**: Build a beautiful, responsive React application integrated with Monaco Editor, forms, and task dashboards.
**Depends on**: Phase 6
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria**:
  1. User is wowed by a premium, dark-mode-first dashboard utilizing smooth transitions.
  2. Admin can write policies inside Monaco Editor with real-time grammar checks and version panels.
  3. Users can submit leaves through dynamic form, and managers have an instant approve/reject task inbox.
**Plans**: 4 plans
- [ ] 07-01: Bootstrap the React layout, routes, and styling theme system.
- [ ] 07-02: Build Monaco DSL Editor and validation panel.
- [ ] 07-03: Build request submission forms and history panels.
- [ ] 07-04: Build approval inbox, decision details, and audit log viewer.

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Tenant & Core Data Model Setup | 0/3 | Not started | - |
| 2. Safe DSL Interpreter Engine | 0/3 | Not started | - |
| 3. Policy Versioning & Immutability | 0/2 | Not started | - |
| 4. Request Submission & Policy Evaluation | 0/2 | Not started | - |
| 5. Dynamic Approval Workflow Engine | 0/2 | Not started | - |
| 6. Audit Logging & Ledger | 0/2 | Not started | - |
| 7. Frontend Application & Monaco Editor | 0/4 | Not started | - |
