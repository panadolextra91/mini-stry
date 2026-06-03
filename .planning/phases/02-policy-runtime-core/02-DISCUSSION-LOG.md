# Phase 2: Policy Runtime Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `02-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 2-policy-runtime-core
**Areas discussed:** JSON Schema validator engine, Rule structure & decision binding, EvaluationContext lookup semantics, Decision envelope & trace data, Module structure

---

## JSON Schema validator engine

### Engine choice

| Option                    | Description                                                                                                                                                                         | Selected |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Ajv (JSON Schema 2020-12) | Industry standard, AOT-compiled validators, formats add-on, RFC-aligned error paths. ~150KB. Schema is plain JSON → reusable for Monaco autocomplete in Phase 6 without conversion. | ✓        |
| Zod (TS-first)            | Schema written in TS, type inference built in. Very clean under strict TS. Trade-off: not pure JSON Schema — must convert via `zod-to-json-schema` for Monaco.                      |          |
| TypeBox                   | TS builders that emit JSON Schema + types simultaneously. Good for both runtime validation and Monaco. Verbose API, smaller community vs Ajv/Zod.                                   |          |
| Hand-rolled validator     | Zero deps, full control, fits MVP principle. Trade-off: must maintain a JSON Schema subset + error reporting + still need a way to expose schema for Monaco.                        |          |

**User's choice (D-21):** Ajv + JSON Schema 2020-12.
**Notes:** Treats JSON Schema as the canonical validation format. Validation implementation is an infrastructure concern. Validator-specific error formats must be wrapped into domain-level `ValidationError`s.

### Validator port shape

| Option                              | Description                                                                                                                                                                                           | Selected |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Port in runtime + Ajv adapter       | `SchemaValidatorPort` in `runtime/ports/`, Ajv adapter in `runtime/adapters/ajv/`. Constructor-injected per D-18. Enforces error isolation; allows future engine swap.                                | ✓        |
| Module function + direct Ajv import | Export `validatePolicyContent(...)` from `runtime/`, import Ajv internally. Simpler but couples runtime → Ajv and violates "validation is infrastructure" (D-21).                                     |          |
| Adapter-only (no port)              | Ajv adapter at `runtime/adapters/ajv/`, exposed function via barrel. Less boilerplate, but Phase 3 lifecycle ends up calling the adapter directly — breaks symmetry with `RoleService`/`UserService`. |          |

**User's choice (D-22):** Port + adapter. Primary purpose is **error-shape isolation**, not engine replaceability.

### Canonical schema artifact location

| Option                                   | Description                                                                                                                                         | Selected |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Static `.json` in `runtime/schema/`      | `policy-content.schema.json` imported via `with { type: 'json' }`. Same artifact reused by UI and lifecycle. Transparent, version-control friendly. | ✓        |
| TypeBox / builder code                   | Schema authored in TS, JSON Schema emitted at runtime. Adds a dep (TypeBox), conflicts with D-21's Ajv choice.                                      |          |
| `as const satisfies JSONSchema7` literal | Type-checked at compile time, runtime is plain JSON Schema, no extra deps. Convenient but TS types still live separately.                           |          |

**User's choice (D-23):** Standalone JSON Schema documents at `runtime/schema/policy-content.schema.json`. Schemas are versioned product artifacts and the source of truth. TypeScript types may be generated from schemas, but schemas remain canonical. **Avoid schema-builder DSLs that make TypeScript the canonical representation.**

---

## Rule structure & decision binding

### PolicyContent shape

| Option                                                     | Description                                                                                                                                                   | Selected |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Match-first rule list (each rule carries its own Decision) | `{ rules: [{when, decision}, ...], default: Decision }`. Evaluate top-down; first match wins; default fallback. Deterministic, auditable. RUN-04 stays in v2. | ✓        |
| Flat predicate list + implicit AND + single outcome        | `{ conditions: [...], thenDecision, elseDecision }`. All conditions AND'd; binary branching only.                                                             |          |
| Boolean tree with AND/OR/NOT in v1                         | `{ when: {all: [...]} , decision }`. Pulls RUN-04 forward. Most expressive but most complex; conflicts with v1/v2 split.                                      |          |

**User's choice (D-24):** Match-first rule list. Rule shape `{ id, when, decision }`. `defaultDecision` fallback. **Decision is modeled as an object, not a string literal**, for future extensibility. AND/OR/NOT deferred to RUN-04.

### Predicate shape

| Option                                                | Description                                                                                                                               | Selected |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Single-comparison object `{field, op, value}`         | Each rule has exactly one comparison; combine via multiple rules. Matches the example in REQUIREMENTS.md. Simplest schema + evaluator.    |          |
| Array of comparisons with implicit AND                | `when: [{...}, {...}]`. More convenient but introduces hidden AND semantics outside RUN-04.                                               |          |
| Tagged predicate `{type:'compare', field, op, value}` | Tagged discriminator from day one. Pre-bakes extension slot for v2 `{type:'and'}`, `{type:'or'}`, `{type:'not'}`. Slightly verbose in v1. | ✓        |

**User's choice (D-25):** Tagged-discriminator predicate. Only `"compare"` type supported in v1; future types added via schema extension without breaking the root predicate shape.

### Operator set + type policy

| Option                                                  | Description                                                                                                               | Selected |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| Strict 4 ops (REQUIREMENTS verbatim) + strict same-type | `eq, gt, lt, contains` only. Strict type matching; no coercion. Minimum surface.                                          |          |
| Extended 8 ops + strict same-type                       | `eq, neq, gt, gte, lt, lte, contains, in`. Still strict-type. Covers most real policies.                                  | ✓        |
| Strict 4 ops + coercion (lax)                           | `eq, gt, lt, contains` with implicit type coercion (`"5" gt 2 → true`). Convenience but risky and against engineering.md. |          |

**User's choice (D-26):** Extended 8 ops with strict type safety and **no coercion**. Type-aware applicability matrix — **Number:** eq/neq/gt/gte/lt/lte/in; **String:** eq/neq/contains/in. Type mismatch → `ValidationError`.

---

## EvaluationContext lookup semantics

### Shape + lookup style

| Option                                              | Description                                                                                  | Selected |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------- |
| Flat `Record<string, JsonValue>`, single-key lookup | Top-level keys only. Deterministic, simple schema.                                           | ✓        |
| Nested objects + dotted-path lookup                 | `field: "user.role"` resolved via path parser. More flexible, more surface, more edge cases. |          |
| Flat + dotted-path as literal string keys           | Keys may contain `.` but evaluator does not parse. Confusing.                                |          |

**User's choice (D-27):** Flat `Record<string, JsonValue>`. Direct top-level lookup. Runtime does no path parsing. **Caller is responsible for flattening/projection.** Nested traversal deferred.

### Missing-field / type-mismatch behavior

| Option                                   | Description                                                                                                        | Selected |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| Throw `EvaluationError` (fail-fast)      | Missing field or type mismatch → throw with structured code. Exposes contract bugs early.                          | ✓        |
| Predicate returns false, skip rule       | Tolerant — wrong shape silently falls through to default. Risk of silent bugs.                                     |          |
| Throw on missing, false on type mismatch | Split: missing = contract violation (throw); wrong type = predicate false (skip). More nuanced but more confusing. |          |

**User's choice (D-28):** Fail-fast. `EvaluationError` codes: `MISSING_FIELD`, `TYPE_MISMATCH`, `UNSUPPORTED_OPERATOR`. **Predicate failure** strictly means: field exists, types valid, comparison evaluates false.

---

## Decision envelope & trace data

### Decision shape

| Option                                  | Description                                                                                                                     | Selected |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Discriminated union by `kind`           | `{kind:'auto-approve'} \| {kind:'auto-reject'} \| {kind:'request-approval', ...}`. TS exhaustiveness; per-variant typed fields. | ✓        |
| Flat record with `outcome` + `metadata` | Open `outcome` string + untyped metadata bag. Loses exhaustiveness; downstream reads metadata by string keys.                   |          |
| Tagged class hierarchy                  | OOP inheritance, `instanceof` checks. Conflicts with Phase 1 D-13 (entities = plain interfaces).                                |          |

**User's choice (D-29):** Discriminated union. `request-approval` carries `targetRoleId: RoleId` from `@/modules/directory`. **Decision metadata is variant-specific, never an untyped bag.** Future kinds added via union extension.

### Evaluator output

| Option                                  | Description                                                                                                                  | Selected |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| `EvaluationResult` with full path trace | `{decision, matchedRuleId, evaluationTrace: [{ruleId, matched}]}`. Trace is a runtime concern; AUD-02 (Phase 4) persists it. | ✓        |
| Minimal `{decision, matchedRuleId}`     | Smaller surface; Phase 4 reconstructs trace by re-running the evaluator with instrumentation. Risk of drift.                 |          |
| `Decision` only; trace deferred         | Phase 4 needs a parallel "tracing evaluator" — duplicative.                                                                  |          |

**User's choice (D-30):** `EvaluationResult { decision, matchedRuleId, evaluationTrace[] }`. Evaluator records rule traversal during normal execution. Audit persistence deferred to later phases.

---

## Module structure

### Split runtime/ + decision/ or keep together?

| Option                                                                                 | Description                                                                                | Selected |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| Split: `runtime/` + `decision/`                                                        | Mirrors Concept Hierarchy positions #4 and #5. Two barrels, two READMEs.                   |          |
| Merged into single `runtime/` module                                                   | `Decision` lives inside the runtime module; no standalone `decision/`.                     | ✓        |
| `Decision` in `runtime/` now; `decision/` reserved for Phase 5 consumer infrastructure | Misreads the Concept Hierarchy slightly — Decision #5 is the type, not the consumers (#6). |          |

**User's choice (D-31):** `Decision` lives in `runtime/`. **Avoid creating modules that only contain type definitions.** A dedicated `decision/` module is justified only when independent decision-processing capabilities emerge (dispatching, consumers, projections, workflows).

---

## Claude's Discretion

Items the planner / researcher will lock during Phase 2 planning (consistent with the decisions above):

- Exact `ValidationResult` / `ValidationError` shape (must be domain-level, must aggregate errors).
- TypeScript-from-schema strategy: codegen step (`json-schema-to-typescript`) or hand-written types kept in sync.
- Test fixture layout (`__fixtures__/` co-location vs. central `tests/fixtures/`).
- ESLint `import/no-restricted-paths` zone syntax for `runtime/` (mirror Phase 1 zones).
- Custom error class file layout (`runtime/application/errors.ts`).
- Optional Decision factory helpers (`autoApprove()`, `requestApproval(roleId)`).
- Predicate `value` typing per operator inside the JSON Schema (`if/then/else` vs. `oneOf` per `op`).
- Branded ID factory for `RuleId` (mirror `directory/domain/ids.ts`).

## Deferred Ideas

Captured in `02-CONTEXT.md` `<deferred>` section. Summary:

- AND/OR/NOT logical operators → RUN-04 (v2).
- Implicit-AND arrays in `when` → RUN-04 (v2).
- Nested EvaluationContext + dotted-path → v2.
- Type coercion → rejected; not on roadmap.
- Additional Decision variants → DEC-04/05 (v2).
- `decision/` module → Phase 5+ (consumers, dispatching).
- Audit persistence of `evaluationTrace` → Phase 4 (AUD-02).
- `PolicyVersion.content` typing as `PolicyContent` → Phase 3 (lifecycle is the cleaner seam).
- JSON-schema-to-TypeScript codegen → optional; defer until type drift.
- Decision factory helpers → optional; defer until fixtures get noisy.
- Evaluator performance benchmarks → out of scope per MVP Principle.
