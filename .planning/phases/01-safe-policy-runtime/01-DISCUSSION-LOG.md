# Phase 1: Safe Policy Runtime & DSL Parser - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 01-safe-policy-runtime
**Areas discussed:** Phase Sequence Ordering, Security/Execution, DSL Syntax Design, Domain Models Placement

---

## Phase Sequence Ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Directory-First Sequence | Build Tenants, Users, and Roles in Phase 1; Policy engine in Phase 2. | |
| Policy-First Sequence | Build the Safe Policy Runtime and DSL Parser in Phase 1; Directories in Phase 4. | ✓ |

**User's choice:** Policy-First Sequence.
**Notes:** Anchors the project narrative firmly around the Policy Runtime Platform. Directory context structures are supporting context providers, planned *around* the engine.

---

## Security / Execution

| Option | Description | Selected |
|--------|-------------|----------|
| Dynamic JS Eval | Evaluate DSL strings using Javascript `eval()` or `Function()`. Simple but insecure. | |
| AST Interpreter | Compile DSL strings into a structured Abstract Syntax Tree (AST), evaluated by a secure recursive parser. | ✓ |

**User's choice:** Secure non-eval AST Interpreter.
**Notes:** Required to meet strict security criteria and prevent malicious code injections.

---

## DSL Syntax Design

| Option | Description | Selected |
|--------|-------------|----------|
| YAML/JSON-like rules | Simple, human-readable indented text rule arrays (e.g. `rules: if leave_days <= 2 approve_by receptionist`). | ✓ |
| Custom complex grammar | Heavy PEG/Parser grammar. Overengineered for MVP. | |

**User's choice:** YAML/JSON-like rules.
**Notes:** Human-readable, robust, and highly parsable by a lightweight custom scanner.

---

## the agent's Discretion

- Exact Lexer tokens naming conventions.
- AST data structure properties (JSON representation).
- Vitest mock fixtures definitions.

## Deferred Ideas

- Convex schema mappings and persistence adapters — Phase 2/Phase 4.
- User directory dynamic setups — Phase 4.
- Full Audit tracing logging — Phase 5.

---

*Phase: 01-safe-policy-runtime*
*Discussion log generated: 2026-05-31*
