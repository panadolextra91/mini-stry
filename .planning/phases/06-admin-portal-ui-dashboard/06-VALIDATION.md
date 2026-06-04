---
phase: 6
slug: admin-portal-ui-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from 06-RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.7 (`environment: node`) |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm test` (`vitest run --reporter=dot`) |
| **Full suite command** | `npm run test:coverage` |
| **Estimated runtime** | ~10–20 seconds (backend) |

> **Scope note:** The existing harness is node-only (`tests/**/*.test.ts` + `src/**/*.test.ts`). Phase 6 automated tests stay at the **backend layer** (new repository list methods, schema parity, handler boundaries). UI/React behavior is verified via manual demo (D-63 live cross-user flow). A separate `web/vitest.config.ts` with jsdom + Testing Library is optional and a planner scope decision — not required for Nyquist compliance.

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm run test:coverage` (90% global / 100% runtime+approval thresholds) + `npm run lint` + `npm run typecheck`
- **Before `/gsd:verify-work`:** Full suite green + manual demo of the live cross-user flow (D-63)
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| UI-01 | `PolicyVersionRepositoryPort` list-versions returns tenant+policy-scoped versions | unit (fake-db) | `npx vitest run tests/modules/policy/` | ❌ W0 | ⬜ pending |
| UI-01 | `PolicyRepositoryPort.listByTenant` tenant-isolated (A never sees B) | unit (fake-db) | `npx vitest run tests/modules/policy/` | ❌ W0 | ⬜ pending |
| UI-01 | Monaco↔runtime schema parity: barrel-exported schema is the same artifact Ajv loads | unit (parity) | `npx vitest run tests/modules/runtime/schema-parity.test.ts` | ❌ W0 | ⬜ pending |
| UI-02 | List-requests-by-tenant returns only the tenant's evaluations | unit (fake-db) | `npx vitest run tests/modules/request/` | ❌ W0 | ⬜ pending |
| UI-03 | `findByApprover` returns only tasks where `approverId === actorId`, tenant-scoped | unit (fake-db) | `npx vitest run tests/modules/approval/` | ❌ W0 | ⬜ pending |
| UI-03 | Approve/Reject: `act` rejects when `actorId !== approverId` | unit | `npx vitest run tests/modules/approval/` | ⚠️ verify | ⬜ pending |
| UI-04 | Audit list-by-tenant returns tenant-scoped logs in order | unit | `npx vitest run tests/modules/audit/` | ❌ W0 | ⬜ pending |
| D-62 | Seed is idempotent: second run inserts nothing | manual / convex-test | run `seed` twice; assert no duplicate tenants | ❌ W0 | ⬜ pending |
| D-61 | Handlers contain no domain logic | lint (`import/no-restricted-paths`) + review | `npm run lint` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/modules/runtime/schema-parity.test.ts` — asserts the barrel-exported `policyContentSchema` is the canonical artifact Ajv uses (D-59 parity invariant). **Highest-value new test.**
- [ ] Extend `tests/modules/policy/` — list-by-tenant + list-versions-by-policy tenant isolation.
- [ ] Extend `tests/modules/approval/` — `findByApprover` scoping + unauthorized-approver `act` case.
- [ ] Extend `tests/modules/request/` and `tests/modules/audit/` — list-by-tenant scoping (reuses existing `findByTenant`).
- [ ] Framework install: none for backend (Vitest present). `convex-test@0.0.53` only if handler integration tests are chosen.

*Existing infra covers domain/runtime/approval behavior at 100%; the gaps above are the new read paths + the parity invariant.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live cross-user reactive flow | UI-02/03/04, D-63 | Convex reactivity + multi-actor UI is integration/visual | With two demo users selected, submit a request as requester → confirm approver's Inbox updates without refresh → approve → confirm requester status + audit timeline update |
| Monaco live diagnostics/autocomplete | UI-01, D-58 | Editor rendering behavior | Type an invalid policy JSON → red markers appear; valid → autocomplete suggests schema keys |
| Premium dark-mode visual contract | UI-01..04, UI-SPEC | Visual judgment | Spot-check spacing/typography/color against 06-UI-SPEC.md |
| Demo Context Selector tenant switch | D-55/56 | Visual + reactive | Switch tenant → all lists reload scoped to new tenant |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
