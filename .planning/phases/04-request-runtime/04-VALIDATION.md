---
phase: 4
slug: request-runtime
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-03
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `04-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.7 (already installed since Phase 1) |
| **Config file** | none standalone — `vitest run` resolves `@/` alias via `tsconfig.json` paths (existing `tests/**` prove the mechanism) |
| **Quick run command** | `npx vitest run tests/modules/request --reporter=dot` |
| **Full suite command** | `npm test` (`vitest run --reporter=dot`) / `npm run test:coverage` |
| **Estimated runtime** | ~5–15 seconds (unit, in-memory fakes) |

---

## Sampling Rate

- **After every task commit:** `npx vitest run tests/modules/request --reporter=dot` (plus `tests/modules/policy/policy-service.test.ts` when editing `createPolicy`)
- **After every plan wave:** `npm test` (full suite — `createPolicy`/`Policy` changes ripple into policy + audit suites)
- **Before `/gsd:verify-work`:** Full suite green + `npm run test:coverage` meeting the 100% bar on Decision Generation / Policy Engine paths (PROJECT.md Testing Constraint)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Requirement-level map seeded from RESEARCH §Phase Requirements → Test Map. Task IDs are bound to plans during `/gsd:execute-phase`; the executor updates the Task ID / Status columns as Wave 0 stubs turn green.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01 | 01 | 1 | DEC-01 (success) | — | submit → resolve active version → evaluate → `RequestEvaluation{status:'completed', decision, trace}` | unit | `npx vitest run tests/modules/request/policy-runtime-service.test.ts -t "success" --reporter=dot` | ❌ W0 | ⬜ pending |
| 01-01 | 01 | 1 | DEC-01 / D-41 (resolution failure) | — | unknown `requestType` / no active version → NO record, `ResolutionFailed` event, error thrown | unit | `npx vitest run tests/modules/request/policy-runtime-service.test.ts -t "resolution" --reporter=dot` | ❌ W0 | ⬜ pending |
| 01-01 | 01 | 1 | DEC-01 / D-40 (contract violation) | — | `EvaluationError` → `RequestEvaluation{status:'failed', decision:null, errorCode, fieldPath}`, `EvaluationFailed` event, rethrow | unit | `npx vitest run tests/modules/request/policy-runtime-service.test.ts -t "contract" --reporter=dot` | ❌ W0 | ⬜ pending |
| 02-01 | 02 | 2 | AUD-02 (by-reference audit) | — | each path writes correct `eventType` + reference envelope; NO content (D-37) | unit | `npx vitest run tests/modules/request/request-audit-subscriber.test.ts --reporter=dot` | ❌ W0 | ⬜ pending |
| 02-01 | 02 | 2 | AUD-02 / D-42 (deterministic replay) | — | stored `trace` + immutable `content` + `requestInput` reproduce the decision | unit | `npx vitest run tests/modules/request/replay.test.ts --reporter=dot` | ❌ W0 | ⬜ pending |
| 01-01 | 01 | 1 | CON-01 (tenant isolation) | tenant leak | a `RequestEvaluation`/resolution is never visible/usable across tenants | unit | `npx vitest run tests/modules/request -t "tenant" --reporter=dot` | ❌ W0 | ⬜ pending |
| 01-01 | 01 | 1 | D-39 (`createPolicy` requestType) | — | `createPolicy` rejects duplicate `[tenantId, requestType]`; `requestType` persisted | unit | `npx vitest run tests/modules/policy/policy-service.test.ts -t "requestType" --reporter=dot` | ⚠️ extend existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/modules/request/policy-runtime-service.test.ts` — stubs for DEC-01 (3 outcome paths: success, resolution-failure, contract-violation)
- [ ] `tests/modules/request/request-audit-subscriber.test.ts` — stubs for AUD-02 by-reference + D-37 no-content
- [ ] `tests/modules/request/replay.test.ts` — stubs for D-42 deterministic replay
- [ ] `tests/_helpers/in-memory-fakes.ts` — add `setupRequest(validator)` helper (mirrors `setupPolicy`; wires `EventDispatcher<RequestEventMap>` + `void new RequestAuditSubscriber(...)` + `InMemoryRequestEvaluationRepository`)
- [ ] Extend `tests/modules/policy/policy-service.test.ts` `createPolicy` tests for the new `requestType` arg + `[tenantId, requestType]` uniqueness (existing test ~lines 35–45 breaks on the signature change otherwise)
- [ ] No framework install needed — Vitest already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Convex schema sync (`requestEvaluations` table + `policies.requestType` index) applies to the live deployment | DEC-01 / AUD-02 | Schema reaches the database via the Convex dev/deploy server, not a unit test | Run `npm run convex:dev` (or `npx convex dev`) and confirm the `requestEvaluations` table + new `policies` index appear without validation errors |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-03 (plan-checker VERIFICATION PASSED; Dimension 8 satisfied. `wave_0_complete` flips true during execution.)
