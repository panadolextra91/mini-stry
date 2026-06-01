---
phase: 3
slug: policy-lifecycle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-01
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/modules/policy/ --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/modules/policy/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | POL-01, POL-02 | unit | `npx vitest run tests/modules/policy/policy-service.test.ts -t "createDraft"` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | POL-02, POL-03 | unit | `npx vitest run tests/modules/policy/policy-service.test.ts -t "publish"` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | POL-03 | unit | `npx vitest run tests/modules/policy/policy-service.test.ts -t "immutab"` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | POL-04 | unit | `npx vitest run tests/modules/policy/policy-service.test.ts -t "rollback"` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | AUD-01 | unit | `npx vitest run tests/modules/audit/audit-subscriber.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/modules/policy/policy-service.test.ts` — stubs for POL-01, POL-02, POL-03, POL-04
- [ ] `tests/modules/audit/audit-subscriber.test.ts` — stubs for AUD-01
- [ ] `tests/_helpers/in-memory-fakes.ts` — extend with policy/audit repository fakes

*Existing Vitest infrastructure is sufficient — no new framework install needed.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
