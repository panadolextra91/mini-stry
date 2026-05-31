# Phase 1: Safe Policy Runtime & DSL Parser - Research

**Researched:** 2026-05-31
**Domain:** Lexical Scanning, AST Parsing, and Secure Interpreters in Pure TypeScript
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01**: The platform must remain 100% domain-neutral. No HR-specific static code, role enums, or HR-only business assumptions are allowed. Leave requests are purely a demonstration workflow.
- **D-02**: Policies, versions, and runtime are first-class primitives. User directories and role contexts exist strictly as supporting inputs to feed evaluation transactions.
- **D-03**: Strict ban on dynamic `eval()`, `Function()`, or dynamic script tags. The DSL engine must implement a deterministic, recursive descent AST compiler and interpreter in Pure TS, guaranteeing 100% safety and predictability.
- **D-04**: The custom DSL syntax supports policy metadata, sequential rules, basic comparisons (`<=`, `>`, `==`), and variable lookups.
- **D-05**: Register foundational domain entity skeletons inside Phase 1: `PolicyEntity`, `PolicyVersionEntity`, `AuditLogEntity`, `TenantEntity`, `UserEntity`, `RoleEntity`.
- **D-06**: Establish `policy` modular hexagonal architecture folder layout in `src/modules/policy`.

### the agent's Discretion
- Exact Lexer tokens naming conventions.
- AST data structure properties (JSON representation).
- Vitest mock fixtures definitions.

### Deferred Ideas (OUT OF SCOPE)
- Convex schema mappings and persistence adapters — Phase 2/Phase 4.
- User directory dynamic setups — Phase 4.
- Full Audit tracing logging — Phase 5.

</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| DSL lexical scanning | Domain (Pure TS) | — | Tokenizes raw DSL string inputs into clean structural tokens |
| AST rule parsing | Domain (Pure TS) | — | Compiles tokens into a queryable Abstract Syntax Tree (AST) representing logic |
| Rule evaluation | Domain (Pure TS) | — | Interprets AST against dynamic payloads, computing decisions safely without eval |
| Orchestration service | Application Layer | — | Service layer taking policy DSL and dynamic payload, executing compilations and runs |
| Testing & Verification | Vitest (Local) | — | Comprehensive test cases executing AST evaluations against dynamic structures |

</architectural_responsibility_map>

<research_summary>
## Summary

This research establishes the compiler-design foundation for our secure, domain-neutral policy engine runtime. Since **Mini-stry** is a Policy Runtime Platform, the DSL Parser and AST Interpreter must be exceptionally robust, deterministic, and highly testable in isolation. 

To achieve 100% security and dynamic evaluation without platform or database lock-in:
1. We design a safe, pure-TypeScript Lexer that splits custom rule strings into a deterministic stream of structural tokens (e.g. Identifier, Operator, Literal, Keyword).
2. The AST Parser compiles these tokens into a tree representation representing the policy schema (`PolicyAST` containing rule statements).
3. The AST Interpreter executes recursive checks against dynamic payloads (e.g., `{ leave_days: 5 }`) and evaluates logical statements securely (using strict TS comparison functions rather than dynamic JS evaluation).
4. Skeletons for `PolicyEntity`, `PolicyVersionEntity`, and other directory entities are mapped in the domain layer.
5. All operations are verified with a 100% logic coverage Vitest suite.

**Primary recommendation:** Build a custom, deterministic scanner and a recursive descent compiler in pure TypeScript to achieve high execution speed, perfect security, and testability.

</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| typescript | ^5.0.0 | Static Typing | Required for AST tree typings and compiler safety |
| vitest | ^1.5.0 | Test Runner | Enforces testing rules with fast execution |

**Installation:**
```bash
npm install -D vitest @types/node typescript
```

</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Compiler Data Flow Diagram
```
[Raw DSL String] --(Lexer)--> [Token Stream] --(Parser)--> [Abstract Syntax Tree (AST)]
                                                                  │
                                                                  ▼
[Dynamic Payload] ────────────────────────────────────────> [Interpreter]
                                                                  │
                                                                  ▼
                                                       [Structured Decision]
                                                (e.g., Auto-Approve, Trigger Task)
```

### Pattern 1: Safe AST Parser Node Types
Define clean, strongly typed representations of compiler rules in pure TS.
```typescript
// src/modules/policy/domain/types.ts

export type TokenType = 'IDENTIFIER' | 'OPERATOR' | 'LITERAL' | 'KEYWORD' | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
}

export interface ASTNode {
  type: string;
}

export class ComparisonNode implements ASTNode {
  readonly type = 'ComparisonNode';
  constructor(
    public readonly variable: string,
    public readonly operator: '<=' | '>' | '==' | '<' | '>=',
    public readonly value: number | string
  ) {}
}

export class RuleNode implements ASTNode {
  readonly type = 'RuleNode';
  constructor(
    public readonly condition: ComparisonNode,
    public readonly actionRole: string
  ) {}
}

export class PolicyAST implements ASTNode {
  readonly type = 'PolicyAST';
  constructor(
    public readonly name: string,
    public readonly rules: RuleNode[]
  ) {}
}
```

### Pattern 2: Secure AST Interpreter (No Eval)
Implement deterministic evaluation using strict TypeScript logic rather than dynamic JS execution.
```typescript
// src/modules/policy/domain/interpreter.ts
import { PolicyAST, RuleNode } from "./types";

export class ASTInterpreter {
  evaluate(ast: PolicyAST, payload: Record<string, any>): string | null {
    for (const rule of ast.rules) {
      if (this.evaluateCondition(rule.condition, payload)) {
        return rule.actionRole; // Evaluates to the target role (e.g. "manager", "CEO")
      }
    }
    return null; // Evaluates to no match (default fallback)
  }

  private evaluateCondition(node: any, payload: Record<string, any>): boolean {
    const value = payload[node.variable];
    if (value === undefined) return false;

    switch (node.operator) {
      case '<=': return value <= node.value;
      case '>': return value > node.value;
      case '==': return value == node.value;
      case '<': return value < node.value;
      case '>=': return value >= node.value;
      default: return false;
    }
  }
}
```

### Anti-Patterns to Avoid
- **Javascript `eval()`**: Executing rules using `eval("payload.leave_days <= 2")`. This creates massive security vulnerabilities and violates core constraints.
- **Leaking HR Assumptions**: Writing HR department checks directly in parser rules (e.g., hardcoding department managers). The interpreter must operate on generic variable/key evaluations.

</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Safe arithmetic parsing | Complex regex logic | Recursive descent parsing | Regex fails on nested structures and complex operators, while recursive descents scale. |

</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Space/Tab Scanning Instability
**What goes wrong:** Rules fail parsing because of unexpected double spaces or tab indentations (e.g., `leave_days   <= 2`).
**How to avoid:** Build a robust Lexer that trims structural whitespace and sanitizes token boundaries prior to feeding the parser.

### Pitfall 2: Payload Variable Type mismatches
**What goes wrong:** Payload variable contains a string (`"5"`) but the rule performs a numerical check (`<= 2`), causing execution errors.
**How to avoid:** The interpreter must dynamically parse/cast compared strings into numerical values if the AST rule literal represents a number.

</common_pitfalls>

<sources>
## Sources

### Primary (HIGH confidence)
- Compiler Design & Theory standards (Lexical scanners, AST syntax parsers, recursive descend interpreters).
- TypeScript strict compiler handbooks.

</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Lexers, Parsers, safe AST interpreters, TS types.
- Ecosystem: Pure TypeScript compilers, Vitest.
- Patterns: Deterministic scanning, non-eval execution.

**Confidence breakdown:**
- Standard stack: HIGH
- Architecture: HIGH
- Pitfalls: HIGH

**Research date:** 2026-05-31
**Valid until:** 2026-06-30
</metadata>

---

*Phase: 01-safe-policy-runtime*
*Research completed: 2026-05-31*
*Ready for planning: yes*
