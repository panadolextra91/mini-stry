---
phase: 5
slug: approval-routing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `05-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.7 (v8 coverage) |
| **Config file** | `vitest.config.ts` (node env; `@` → `src` alias; includes `tests/**/*.test.ts` + `src/**/*.test.ts`) |
| **Quick run command** | `npx vitest run tests/modules/approval --reporter=dot` |
| **Full suite command** | `npm test` (`vitest run --reporter=dot`) |
| **Coverage command** | `npm run test:coverage` |
| **Estimated runtime** | ~10–30 seconds (fakes-only, no live Convex) |

**Coverage targets (from `docs/engineering.md` + `vitest.config.ts`):**
- `docs/engineering.md` line 42 mandates **"Approval Workflow Generation: 100%"** — stricter than the 90% global threshold. Routing resolution + state machine are 100% targets.
- Recommend pinning `src/modules/approval/**` at 100% (matching the existing `src/modules/runtime/**` pin).
- Coverage **excludes** `index.ts` barrels and `adapters/convex/**` — the 100% applies to `domain` + `application` + `adapters/memory`, all reachable via in-memory fakes.

---

## Sampling Rate

- **After every task commit:** `npx vitest run tests/modules/approval --reporter=dot` (fast, fakes-only)
- **After every plan wave:** `npm test` (full suite — guards the `EventDispatcher` / `TenantContext` / `RequestEvaluation` ripples against Phase 1–4 regressions)
- **Before `/gsd:verify-work`:** `npm run test:coverage` green with approval module at 100% (domain+application+memory), plus `npm run lint` (new ESLint zone enforced) + `tsc --noEmit`
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> Requirement → behavior → test mapping from research. Task IDs (`5-0X-YY`) are bound to
> plan tasks at planning time; `/gsd:validate-phase` / the nyquist-auditor reconcile this
> table against the final PLAN.md task list.

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| DEC-03 | `request-approval` decision → chain+task materialized; non-request-approval ignored | unit (service+fakes) | `npx vitest run tests/modules/approval/routing-service.test.ts` | ❌ W0 |
| DEC-03 (SC#1) | `request/` has no import of `approval/` (runtime stays agnostic) | static (eslint+grep) | `npm run lint` + `! grep -r "modules/approval" src/modules/request` | ❌ W0 |
| DEC-03 (D-49) | Walk hit: first ancestor holding `targetRoleId` becomes approver | unit | routing-service.test.ts `describe("resolveApprover")` | ❌ W0 |
| DEC-03 (D-49) | Walk miss: chain ends, no holder → `RoutingError`, no task created | unit | same | ❌ W0 |
| DEC-03 (D-49) | Self-exclusion: walk starts at `requester.managerId`; requester never self-approves | unit | same | ❌ W0 |
| DEC-03 (D-50) | Depth cap: >50 hops → `HierarchyTraversalError` | unit | same | ❌ W0 |
| DEC-03 (D-50/SC#3) | Missing `targetRoleId` in registry → `RoleNotFoundError`, no walk | unit | same | ❌ W0 |
| DEC-03 (D-51) | Task transitions PENDING→APPROVED / PENDING→REJECTED; terminal rejects further | unit (pure) | `npx vitest run tests/modules/approval/state-machine.test.ts` | ❌ W0 |
| DEC-03 (D-51) | Chain status: any REJECTED→REJECTED; all APPROVED→APPROVED; else IN_PROGRESS | unit (pure) | same | ❌ W0 |
| DEC-03 (D-52) | Auth guard: non-approver acting → `UnauthorizedApproverError` | unit | routing-service.test.ts `describe("act")` | ❌ W0 |
| DEC-03 (D-52) | Idempotency: acting on terminal task → `TaskAlreadyResolvedError` | unit | same | ❌ W0 |
| DEC-03 (D-44) | Immutability: changing `managerId` after creation does not alter stored `approverId` | unit | same | ❌ W0 |
| DEC-03 | Same `evaluationRecordId` emitted twice → exactly one chain | unit | same | ❌ W0 |
| DEC-03 (D-53) | Approve/Reject emits `ApprovalTaskApproved/Rejected`; audit subscriber writes by-reference (no content) | unit | `npx vitest run tests/modules/approval/approval-audit-subscriber.test.ts` | ❌ W0 |
| DEC-03 (D-54) | Throwing subscriber does not stop siblings; `emit` does not reject | unit | extend `tests/modules/policy/event-dispatcher.test.ts` (+2 cases) | ⚠️ partial |
| DEC-03 (D-54) | Routing failure → `ApprovalRoutingFailed` emitted + audited; `RequestEvaluation` still persisted | unit | routing-service.test.ts | ❌ W0 |
| DEC-03 (D-48) | `submit()` threads `ctx.actorId → RequestEvaluation.requesterId` | unit | extend `tests/modules/request/policy-runtime-service.test.ts` | ⚠️ partial |
| CON-01 | Cross-tenant: chain/task reads filtered by `ctx.tenantId` | unit | routing-service.test.ts + repo fakes | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/modules/approval/routing-service.test.ts` — DEC-03 walk / auth / idempotency / immutability / failure
- [ ] `tests/modules/approval/state-machine.test.ts` — D-51 transition tables (pure)
- [ ] `tests/modules/approval/approval-audit-subscriber.test.ts` — D-53 by-reference audit
- [ ] `tests/_helpers/in-memory-fakes.ts` — extend/add `setupApproval` to wire routing service + chain/task fakes + approval dispatcher
- [ ] `tests/_helpers/*` — manager-hierarchy fixture builder (`managerId`/`roleId` graphs → expected approver tuples)
- [ ] Extend `tests/modules/policy/event-dispatcher.test.ts` — +2 subscriber-isolation cases (D-54)
- [ ] Extend `tests/modules/request/policy-runtime-service.test.ts` — `actorId → requesterId` threading (D-48)
- [ ] Framework install: none — Vitest already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Convex schema push for `approvalChains`/`approvalTasks` + `requestEvaluations.requesterId` | DEC-03 | Live Convex deploy is outside the Vitest fakes boundary (`adapters/convex/**` excluded from coverage) | Run the project's Convex push/dev command; confirm new tables + indexes exist and typecheck passes |

*All core business behaviors (routing resolution, state machine, audit, subscriber isolation) have automated verification via in-memory fakes.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
