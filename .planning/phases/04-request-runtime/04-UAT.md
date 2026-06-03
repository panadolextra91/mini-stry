---
status: complete
phase: 04-request-runtime
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md]
started: 2026-06-03T07:00:38Z
updated: 2026-06-03T07:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test (Convex schema sync)

expected: Run `npm run convex:dev` from clean state — server boots, `requestEvaluations` table + `policies.by_tenant_request_type` index sync, no schema validation errors.
result: pass
note: "Initially FAILED (blocker) — `convex codegen` could not bundle (node:url/path/fs in ajv-schema-validator.ts) and, once bundling was fixed, its typecheck failed on unresolved `@/` aliases. Both resolved (see Gaps → status: resolved). `npx convex codegen` now exits 0 (bundles + typechecks); 180/180 tests, typecheck, and lint remain green."

### 2. Submit a request → Decision (DEC-01 success)

expected: submitRequest returns a RequestEvaluation status 'completed' with decision + trace; record persisted and retrievable.
result: pass

### 3. Contract violation → failed record + rethrow (D-40)

expected: EvaluationError thrown; failed record (decision null, errorCode/fieldPath, trace []) persisted; rethrown.
result: pass

### 4. Resolution failure → no record (D-41)

expected: Unknown requestType / no active version throws and creates NO record.
result: pass

### 5. Audit trail is by-reference (AUD-02 / D-37)

expected: AuditLog entries hold only IDs/metadata; no requestInput/decision/trace content.
result: pass

### 6. requestType uniqueness + tenant isolation (D-39 / CON-01)

expected: Duplicate [tenantId, requestType] rejected; same requestType allowed cross-tenant; tenant B cannot resolve tenant A's requestType.
result: pass

### 7. Deterministic replay (D-42)

expected: Replaying validateAndEvaluate over stored content + requestInput reproduces decision and trace exactly.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

<!-- YAML format for plan-phase --gaps consumption -->

- truth: "The submitRequest Convex handler can be bundled and run in the Convex runtime (convex dev/deploy/codegen succeeds), so submitted EvaluationContexts actually execute end-to-end in production (DEC-01 success criterion 1)."
  status: resolved
  resolution: "Fixed in-session. (1) ajv-schema-validator.ts now imports the JSON schema as a module (`import policyContentSchema ... with { type: 'json' }`) instead of readFileSync+fileURLToPath+path — removes node:fs/url/path so the Convex V8 bundle builds; tsconfig.json gained `resolveJsonModule: true`. (2) convex/tsconfig.json gained `baseUrl: '..'` + `paths: {'@/*': ['src/*']}` (and resolveJsonModule) so the Convex typecheck resolves the `@/` alias used transitively by src modules (pre-existing config debt since Phase 1, surfaced once bundling was fixed). Verified: `npx convex codegen` exits 0, `npm test` 180/180, typecheck 0, lint 0."
  reason: "User reported: `npx convex codegen` fails — Could not resolve node:url / node:path / node:fs from ajv-schema-validator.ts. The Phase 4 thin handler convex/request.ts is the first Convex function to instantiate AjvSchemaValidator, pulling Node-only filesystem APIs into the Convex V8 isolate bundle, which cannot resolve them."
  severity: blocker
  test: 1
  root_cause: "src/modules/runtime/adapters/ajv/ajv-schema-validator.ts loads its JSON schema at construction via readFileSync + fileURLToPath + path.resolve (node:fs/url/path). These Node built-ins are unavailable in the Convex default (V8 isolate) runtime. The whole 180-test Vitest suite runs on Node so the defect is fully masked; it only surfaces when Convex bundles the function (codegen/dev/deploy). Phase 3's convex/policy.ts is an empty placeholder (export {}), so convex/request.ts (Phase 4) is the first Convex function to pull AjvSchemaValidator into the bundle — making this a Phase 4 regression surfaced by the Cold Start Smoke Test."
  artifacts:
  - path: "src/modules/runtime/adapters/ajv/ajv-schema-validator.ts"
    issue: "Uses node:fs/url/path to read policy-content.schema.json from disk; incompatible with the Convex V8 runtime."
  - path: "convex/request.ts"
    issue: "Instantiates new AjvSchemaValidator() inside a Convex mutation, pulling Node APIs into the V8 bundle. ('use node' is not viable — mutations must run in the V8 runtime to access ctx.db.)"
    missing:
  - "Refactor AjvSchemaValidator to embed the JSON schema as a module import (import schema from '../../schema/policy-content.schema.json' with { type: 'json' }, or a .ts module exporting the schema object) instead of reading it from the filesystem — removes node:fs/url/path entirely and works in both Node and Convex runtimes."
  - "Verify the fix with `npx convex codegen` exiting 0 (add to the phase validation/sampling commands so the Node-only test suite no longer masks Convex-runtime bundling failures)."
  - "Re-run the full Vitest suite to confirm the schema-embedding refactor preserves validation behavior."
    debug_session: ""
