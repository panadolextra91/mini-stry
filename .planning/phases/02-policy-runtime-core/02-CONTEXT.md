# Phase 2: Policy Runtime Core - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the **pure-function Policy Runtime**: the side-effect-free core that turns `Policy + EvaluationContext → Decision`. It introduces the `runtime/` module containing:

1. **`EvaluationContext`** — domain-neutral key/value input type (CTX-01, CTX-02).
2. **JSON Schema artifact** for `PolicyContent`, the canonical validation contract (RUN-01, RUN-03).
3. **`SchemaValidatorPort` + Ajv adapter** — rejects malformed policies before evaluation (RUN-03).
4. **Pure-TS evaluator** — match-first rule traversal over typed predicates (RUN-02).
5. **`Decision` discriminated union + `EvaluationResult`** — deterministic, traceable runtime output (DEC-02).

**Phase 2 IS:**
- `src/modules/runtime/{domain, application, ports, adapters, schema, index.ts, README.md}` scaffolded under the same module shape as `directory/` (Phase 1).
- Canonical JSON Schema document at `src/modules/runtime/schema/policy-content.schema.json` — the source-of-truth artifact shared by runtime, lifecycle (Phase 3), and Monaco (Phase 6).
- Defining the shape that fills `PolicyVersion.content` (currently `unknown` per Phase 1 D-12).
- Pure functions / port-injected services; no Convex calls, no `TenantContext`, no persistence.
- 100% test coverage on validator, evaluator, decision emission (engineering.md hard rule).

**Phase 2 IS NOT:**
- `PolicyRuntimeService` orchestration (Phase 4) — that wraps the runtime with `TenantContext` + persistence + audit.
- Draft/publish/immutability/rollback lifecycle (Phase 3) — that layer **reuses** `SchemaValidatorPort` at its boundaries.
- Audit persistence of `evaluationTrace` (Phase 4, AUD-02).
- Any Decision Consumer — approval routing, notifications, escalation (Phase 5+, DEC-03). The runtime emits Decisions and walks away.
- AND/OR/NOT logical operators (RUN-04, v2).
- Nested EvaluationContext, dotted-path lookup, type coercion.
- The `decision/` module — Decision is a domain type, not an independent bounded context (D-31).

**Requirements delivered:** CTX-01, CTX-02, RUN-01, RUN-02, RUN-03, DEC-02

</domain>

<decisions>
## Implementation Decisions

### Validator (RUN-03)

- **D-21 — JSON Schema as canonical validation format:**
  - JSON Schema is the canonical validation format.
  - Validation implementation is an **infrastructure concern**.
  - Runtime and UI integrations consume JSON Schema directly.
  - Validator-specific error formats MUST be wrapped into domain-level `ValidationError`s.
  - **Implementation:** Ajv + JSON Schema 2020-12.

- **D-22 — Hexagonal validator: port + Ajv adapter:**
  - Validation modeled as an infrastructure capability.
  - Runtime application services depend on a `SchemaValidatorPort`.
  - The port returns domain-level `ValidationResult` and `ValidationError` objects.
  - **Ajv-specific error structures MUST never cross the adapter boundary.**
  - **Structure:**
    ```
    src/modules/runtime/
      domain/
      application/
      ports/
        schema-validator.port.ts
      adapters/
        ajv/
          ajv-schema-validator.ts
    ```
  - **Primary purpose of the port is error-shape isolation, not engine replaceability.**

- **D-23 — Canonical schema documents are versioned product artifacts:**
  - Canonical `PolicyContent` schemas stored as standalone JSON Schema documents.
  - **Path:** `src/modules/runtime/schema/policy-content.schema.json`
  - JSON Schema documents are treated as versioned product artifacts.
  - Runtime validation, lifecycle validation (Phase 3), and future Monaco integrations (Phase 6) consume the **same** schema artifact.
  - TypeScript types MAY be generated from schemas, but **schemas remain the source of truth**.
  - **Avoid schema-builder DSLs that make TypeScript code the canonical representation.**

### Rule Model (RUN-01)

- **D-24 — Match-first rule list:**
  - `PolicyContent` v1 is a match-first rule list.
  - Rules are evaluated top-down.
  - The **first matching rule** emits the Decision.
  - If no rule matches, `defaultDecision` is emitted.
  - **Rule shape:** `{ id: RuleId, when: Predicate, decision: Decision }`.
  - **Decision is modeled as an object** rather than a string literal — supports future extensibility (D-29).
  - AND/OR/NOT logic remains deferred to **RUN-04 (v2)**.

- **D-25 — Tagged-discriminator predicate:**
  - Predicate v1 uses a tagged-discriminator shape.
  - **Shape:**
    ```json
    { "type": "compare", "field": "amount", "op": "gt", "value": 10000 }
    ```
  - Only the `"compare"` predicate type is supported in v1.
  - Future predicate types (`"and"`, `"or"`, `"not"`) may be added through schema extension without changing the root predicate shape.
  - Implicit-AND arrays are explicitly deferred to RUN-04 (v2).

- **D-26 — Operators are strict, type-aware, no coercion:**
  - **Operator set (v1):** `eq, neq, gt, gte, lt, lte, contains, in`.
  - Comparisons are strictly type-safe. **No coercion is performed.**
  - Type mismatch → `EvaluationError` (D-28).
  - **Operator applicability is type-aware:**
    - **Number:** `eq, neq, gt, gte, lt, lte, in`
    - **String:** `eq, neq, contains, in`
  - Future operator extensions remain backward-compatible.

### EvaluationContext (CTX-01, CTX-02)

- **D-27 — Flat `Record<string, JsonValue>`:**
  - `EvaluationContext` v1 is a **flat** `Record<string, JsonValue>`.
  - Predicate `field` lookup is a direct top-level key lookup.
  - **Example:** `{ "leave_days": 5, "requester_role": "manager" }`
  - **Runtime performs no path parsing.**
  - Flattening / projection of domain objects into `EvaluationContext` is the **caller's responsibility**.
  - Nested object traversal and dotted-path resolution are **deferred**.

- **D-28 — Fail-fast on contract violations:**
  - Evaluation is fail-fast.
  - Evaluator throws `EvaluationError` when:
    - predicate field is **missing** from `EvaluationContext`
    - operand types are **incompatible**
    - operator is **unsupported**
  - These are **contract violations**, not predicate failures.
  - **Predicate failure** strictly means: field exists, types are valid, comparison evaluates to false.
  - **`EvaluationError` exposes a structured error code:** `MISSING_FIELD`, `TYPE_MISMATCH`, `UNSUPPORTED_OPERATOR`.

### Decision Output (DEC-02)

- **D-29 — Decision as discriminated union with variant-specific fields:**
  - **Shape:**
    ```ts
    type Decision =
      | { kind: 'auto-approve' }
      | { kind: 'auto-reject' }
      | { kind: 'request-approval'; targetRoleId: RoleId };
    ```
  - `PolicyContent` stores `Decision` objects directly inside each rule (and as `defaultDecision`).
  - The evaluator returns the matched `Decision` object **unchanged**.
  - Future decision kinds (escalation, info-request, …) added through union extension.
  - **Decision metadata is strongly typed and variant-specific — never an untyped `metadata` bag.**
  - **Cross-module ref:** the `request-approval` variant references `RoleId` from `@/modules/directory` (allowed via barrel; consistent with `policy/domain/policy.ts` in Phase 1).

- **D-30 — Evaluator returns `EvaluationResult` with first-class trace:**
  - **Shape:**
    ```ts
    type EvaluationResult = {
      decision: Decision;
      matchedRuleId: RuleId | null;       // null when defaultDecision fires
      evaluationTrace: Array<{
        ruleId: RuleId;
        matched: boolean;
      }>;
    };
    ```
  - **Evaluation trace is a runtime concern, not an audit concern.**
  - The evaluator records rule traversal as part of normal execution.
  - Audit persistence of the trace remains **deferred to Phase 4 (AUD-02)**.

### Module Structure

- **D-31 — `Decision` lives in `runtime/`; no standalone `decision/` module:**
  - `Decision` is owned by the Runtime module in Phase 2.
  - `Decision` is a **domain type**, not an independent bounded context.
  - **Runtime module contents:** `Decision`, `Predicate`, `Rule`, `RuleId`, `PolicyContent`, `EvaluationResult`, `EvaluationContext`, validator port + Ajv adapter, evaluator, error classes.
  - A dedicated `decision/` module SHOULD only be introduced when independent decision-processing capabilities emerge (dispatching, consumers, projections, workflows).
  - **Avoid creating modules that only contain type definitions.**

### Claude's Discretion

The following are not locked — the planner and researcher may pick concrete approaches consistent with the decisions above:

- **Branded ID for rules** (`RuleId`) — follow Phase 1 D-14/D-15 (branded string IDs owned by the defining module). Add to `runtime/domain/ids.ts`.
- **`ValidationResult` / `ValidationError` exact shape** — must be domain-level (D-22), expose at least `{ ok: false, errors: ValidationError[] }` so callers can aggregate; specifics are planner's call.
- **TypeScript types from schema** — generate via `json-schema-to-typescript` codegen step at build time, or hand-write types kept in sync with manual review. Either works as long as **schema stays source of truth** (D-23).
- **Test fixture layout** — JSON policy + EvaluationContext + expected EvaluationResult tuples; co-located under `src/modules/runtime/__fixtures__/` or `tests/fixtures/`. Planner's call.
- **ESLint zone for `runtime/`** — add a new `import/no-restricted-paths` zone matching the Phase 1 pattern (D-08) so deep imports into `runtime/domain/*`, `runtime/application/*`, `runtime/adapters/*` are blocked from other modules.
- **Error class layout** — custom error classes per module (consistent with Phase 1 D-13/D-17 directory errors), e.g. `runtime/application/errors.ts` exporting `ValidationError`, `EvaluationError`. No `Result<T, E>` library.
- **Decision factory helpers** — optional ergonomic constructors (`autoApprove()`, `autoReject()`, `requestApproval(targetRoleId)`); fine to add if it cleans up test fixtures.
- **Predicate `value` typing per operator** — JSON Schema can express conditional shapes (`if/then/else` or `oneOf` per `op`); planner's call to enforce `in` taking an array vs. scalars taking the matching scalar type.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or implementing.**

### Vision & Architecture
- `.planning/PROJECT.md` — Project vision, runtime formula `Policy + EvaluationContext → Decision`, Concept Hierarchy, Key Decisions, Hexagonal + Modular Monolith architecture, domain-neutrality + no-`eval()` constraints.
- `.planning/PROJECT.md` §"Concept Hierarchy" — canonical mental model; **Runtime is #4, Decision is #5** (Decision is a type owned by Runtime per D-31, not a separate module).
- `.planning/PROJECT.md` §"Constraints" — no `eval()`, no `any`, Pure TS, 100% coverage on policy engine; **TenantContext is application-layer envelope (Phase 4), not the pure runtime function (Phase 2)**.
- `.planning/PROJECT.md` §"Key Decisions" — "JSON Schema Validation Belongs in Runtime Core", "Decision Consumers Are External to the Runtime", "convex/ HARD RULE".

### Requirements (Active for Phase 2)
- `.planning/REQUIREMENTS.md` §CTX (CTX-01, CTX-02) — `EvaluationContext` as first-class, domain-neutral.
- `.planning/REQUIREMENTS.md` §RUN (RUN-01, RUN-02, RUN-03) — structured JSON rule schemas, safe Pure-TS evaluator, native JSON Schema validation as prerequisite to evaluation.
- `.planning/REQUIREMENTS.md` §DEC (DEC-02) — Auto-Approve / Auto-Reject / Request-Approval; Decision type is **open**.
- `.planning/REQUIREMENTS.md` §"v2 Requirements" — RUN-04 (AND/OR/NOT) is **explicitly out of scope** for v1; D-25 leaves the schema door open for it.

### Phase Plan & Success Criteria
- `.planning/ROADMAP.md` §"Phase 2: Policy Runtime Core" — phase goal, dependencies (Phase 1), success criteria (6 items), plan breakdown (02-01, 02-02, 02-03).

### Phase 1 Inheritance (HARD constraints)
- `.planning/phases/01-core-platform-foundations/01-CONTEXT.md` — entire file is the inherited contract. Specifically:
  - **D-08 (Module Boundary Rule):** *"Cross-module imports are ALLOWED. Cross-module coupling is NOT."* — `runtime/` MUST expose only via its barrel `index.ts`; consumers MUST NOT deep-import. Add ESLint zone for `runtime/` mirroring the existing zones.
  - **D-09 (Logical Tenant Isolation):** runtime is pure and tenant-agnostic; tenant scoping happens in Phase 4 `PolicyRuntimeService`.
  - **D-12 (Phase 1 Skeleton Tables):** `PolicyVersion.content` is intentionally `unknown` at Phase 1; **Phase 2 defines its shape** via the JSON Schema artifact (D-23).
  - **D-13 (Domain Entities = Plain TS Interfaces):** no classes; `PolicyContent`, `Rule`, `Predicate`, `Decision`, `EvaluationResult` are interfaces / union types.
  - **D-14, D-15 (Branded String IDs, Identifier Ownership):** `runtime/` owns `RuleId`. No Convex `Id<>` imports in domain.
  - **D-18 (Constructor-Injected Ports):** application services depend on `SchemaValidatorPort` via constructor; adapter instantiated at composition boundary.
  - **D-19 (`TenantContext`):** **not used by Phase 2 pure runtime**. Phase 4's `PolicyRuntimeService` wrapper will pass `TenantContext` as its first parameter. Keep the runtime pure.
  - **D-20 (Service-First Testing):** 100% on validator + evaluator + decision emission (engineering.md). Co-located unit tests with in-memory fixtures.
- `src/modules/policy/domain/policy-version.ts` — the `content: unknown` field. Phase 2's JSON Schema (D-23) is what fills it; **do NOT narrow `PolicyVersion.content` to `PolicyContent` at the domain layer in Phase 2** unless the planner finds a clean way to do so without coupling the policy module to runtime (Phase 3 lifecycle may be the cleaner place — researcher should flag this).
- `src/modules/directory/index.ts` — `runtime/` will import `RoleId` from here for the `request-approval` Decision variant. Cross-module barrel import is allowed (D-08).
- `src/modules/directory/application/tenant-context.ts` — reference shape; Phase 2 does NOT consume it (kept here for context only).

### Engineering Standards (HARD constraints)
- `docs/engineering.md` §"Testing Requirements" — **Policy Engine: 100% coverage** (validator, evaluator, decision emission). Vitest stack already wired in Phase 1.
- `docs/engineering.md` §"Code Quality" — TS strict mode, no `any`, **no `eval()`, no dynamic code execution**, prefer deterministic logic + pure functions + explicit types.
- `docs/engineering.md` §"Architecture Rules" — Policy Engine isolated from UI; no hardcoded approval logic, tenant-specific conditions, or special-case business logic.
- `docs/engineering.md` §"MVP Principle" — no premature scale optimization, no unnecessary abstractions, boring solutions.

### External References
- **Ajv** (https://ajv.js.org/) — JSON Schema 2020-12 implementation. Pin version in `package.json`. Researcher should confirm latest stable + verify draft-2020-12 support is enabled by default (or via `import Ajv from 'ajv/dist/2020.js'`).
- **JSON Schema Spec (draft 2020-12)** (https://json-schema.org/draft/2020-12/schema) — canonical reference for `policy-content.schema.json`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Module skeleton pattern from Phase 1.** `src/modules/directory/{domain, application, ports, adapters, index.ts, README.md}` is the template — `runtime/` mirrors this shape exactly (+ a new `schema/` sibling for the JSON Schema artifact per D-23).
- **Branded ID pattern:** `src/modules/directory/domain/ids.ts` defines the pattern (`type X = string & { readonly __brand: 'X' }` + factory function `x(value: string): X`). Replicate in `src/modules/runtime/domain/ids.ts` for `RuleId`.
- **Custom error pattern:** `src/modules/directory/application/errors.ts` defines tagged custom error classes (e.g., `RoleNotFoundError`, `ManagerCycleError`). Replicate in `src/modules/runtime/application/errors.ts` for `ValidationError` and `EvaluationError` (with the structured codes from D-28).
- **Barrel + README pattern:** every module has `index.ts` (curated public exports) + `README.md` (documents public API + warns against internal imports). Non-negotiable per Phase 1.
- **Cross-module imports via barrel:** `src/modules/policy/domain/policy.ts` already imports `TenantId` from `@/modules/directory/index.js` — the same pattern applies to `Decision`'s `request-approval` variant importing `RoleId`.

### Established Patterns
- **D-08 enforcement via ESLint `import/no-restricted-paths`:** existing zones cover `directory/`, `policy/`, `audit/`. Phase 2 MUST add a `runtime/` zone matching the same syntax. Researcher should grep `eslint.config.*` for the existing zone definitions.
- **`unknown` for forward-deferred shapes:** `src/modules/policy/domain/policy-version.ts` line 13 explicitly uses `content: unknown` with a comment that "Phase 2 owns the shape." This is the contract Phase 2 fulfills.
- **Vitest unit tests with `__tests__` co-location:** Phase 1 established the test layout; replicate for `runtime/`.
- **ES module `.js` extensions in imports:** Phase 1 code uses `from "./ids.js"` (Node ESM convention). Phase 2 MUST follow.

### Integration Points
- **`PolicyVersion.content` shape contract.** Phase 2's `policy-content.schema.json` (D-23) defines what JSON shape a published `PolicyVersion.content` MUST conform to. The `policy/` module's TypeScript field stays `unknown` in Phase 2; Phase 3 (lifecycle) is where the validator is invoked on save/publish. Researcher: confirm we don't accidentally couple `policy/` → `runtime/` in Phase 2 — Phase 3 is the right time.
- **Composition root for tests.** Constructor-injected `SchemaValidatorPort` (D-22) means tests instantiate `new AjvSchemaValidator(/* opts */)` and inject it. Phase 4 will do the production composition.
- **No Convex involvement in Phase 2.** Schema validator + evaluator are pure functions / pure adapters. Convex handlers (Phase 4+) will instantiate the validator and call evaluation services.
- **Phase 3 reuse hook.** `SchemaValidatorPort` (D-22) is the integration seam: Phase 3 lifecycle (`save`, `publish`) calls the same port instance to validate before persisting. Researcher should note this for downstream phase planning.

</code_context>

<specifics>
## Specific Ideas

- **"Validation is infrastructure" is a stake-in-the-ground principle** (D-21, D-22). The runtime application layer never knows about Ajv. Schema validator port lives in `runtime/ports/`, Ajv adapter in `runtime/adapters/ajv/`. Any future engine swap is a one-adapter change. Repeat this principle in the `runtime/README.md`.

- **JSON Schema documents are versioned product artifacts** (D-23). `runtime/schema/policy-content.schema.json` is NOT a build output, NOT a generated file — it is *the* canonical specification, version-controlled, reviewed in PRs like source code. TypeScript types are derived from it, not the other way around.

- **Predicate failure ≠ contract violation** (D-28). The semantic boundary is sharp and intentional:
  - *Predicate false* = field exists, types valid, comparison evaluates `false` → skip rule, try next.
  - *Contract violation* = missing field / type mismatch / unsupported operator → throw `EvaluationError` with a structured code (`MISSING_FIELD`, `TYPE_MISMATCH`, `UNSUPPORTED_OPERATOR`). Callers (Phase 4 `PolicyRuntimeService`) decide whether to record-and-reject or surface the error.

- **Decision metadata is variant-specific, never an untyped bag** (D-29). Adding a new decision kind = adding a new union variant with its own typed fields. No `metadata: Record<string, unknown>` shortcut, even "temporarily."

- **"Avoid creating modules that only contain type definitions"** (D-31). Module split is driven by independent behavior, not by entity granularity. Phase 5 will create `decision/` only when consumers/dispatching/projections demand it.

- **Tagged-discriminator predicate from day one** (D-25). The `{ "type": "compare", ... }` envelope exists at v1 specifically so v2's `{ "type": "and", "conditions": [...] }` and `{ "type": "or", ... }` can be added without breaking the root predicate position in the schema. Future-proofing the *shape* without implementing the *behavior*.

- **Tagline for `runtime/README.md`:** "Pure functions over EvaluationContext. No `TenantContext`, no Convex, no consumers — just `Policy → Decision`."

</specifics>

<deferred>
## Deferred Ideas

These came up implicitly during discussion as natural follow-ons. None are scope creep — they belong to other phases or v2.

- **AND / OR / NOT logical operators** — RUN-04, v2. Schema is already shaped (D-25 tagged discriminator) to accept `{type:"and"}`, `{type:"or"}`, `{type:"not"}` variants in v2 without breaking v1.
- **Implicit-AND arrays in `when`** — explicitly deferred via D-25. Use multiple rules for now.
- **Nested EvaluationContext / dotted-path lookup** — deferred via D-27. Callers flatten for v1.
- **Type coercion in predicates** — explicitly rejected (D-26). Will not revisit unless real product friction surfaces.
- **Additional Decision variants** (escalation, info-request, multi-stage) — DEC-04/05 in REQUIREMENTS v2. Add as new union members per D-29 when needed.
- **`decision/` module** — defer to Phase 5+ (consumers, dispatching, projections). D-31 makes this explicit.
- **Audit persistence of `evaluationTrace`** — Phase 4 (AUD-02). The trace is produced now; persistence comes later.
- **`PolicyVersion.content` typing as `PolicyContent`** — Phase 3 (lifecycle) is likely the cleaner seam, since lifecycle is where validation happens at save/publish. Researcher should flag during Phase 3 planning whether to narrow there.
- **JSON-schema-to-TypeScript codegen step** — optional (Claude's Discretion above). Add only if hand-written types drift from `policy-content.schema.json`.
- **Decision factory helpers (`autoApprove()`, `requestApproval(roleId)`)** — optional ergonomic constructors; defer unless test fixtures get noisy.
- **Performance benchmarks for evaluator** — out of scope per MVP Principle (`docs/engineering.md`). Defer until real workloads exist.

</deferred>

---

*Phase: 2-Policy Runtime Core*
*Context gathered: 2026-06-01*
