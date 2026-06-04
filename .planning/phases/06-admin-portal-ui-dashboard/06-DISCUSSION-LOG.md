# Phase 6: Admin Portal & UI Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 6-Admin Portal & UI Dashboard
**Areas discussed:** Identity & Tenant Context, Visual Identity & Design System, Policy Editor (Monaco), Backend wiring scope

---

## Identity & Tenant Context

### How the UI establishes identity (tenantId + actorId)

| Option | Description | Selected |
|--------|-------------|----------|
| User/Tenant switcher (impersonation) | Dropdown picks tenant + user being impersonated; no password; demo-friendly | ✓ |
| Login tối thiểu | Minimal email login mapped to user/tenant | |
| Dev context cứng | Hardcoded single tenant + user | |

**User's choice:** Demo Context Selector (D-55) — Active Tenant + Active User selectors populate `TenantContext {tenantId, actorId}`; services consume it as production would.
**Notes:** Non-goals explicitly stated: authentication, sessions, passwords, login flows, authorization middleware. Authentication deferred to a future phase.

### Multi-tenant scope on the UI

| Option | Description | Selected |
|--------|-------------|----------|
| Switch between multiple tenants | UI allows switching tenant to prove logical isolation | ✓ |
| Single tenant (demo) | One fixed tenant | |

**User's choice:** D-56 — switch between multiple **seeded** tenants; user selector filtered by tenant; switching reloads all data. Demonstrates CON-01.
**Notes:** Non-goals: tenant CRUD/administration/onboarding. Fixed seeded demo tenant set.

### Role-based module visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Gate theo role | Modules shown per impersonated user's role | |
| Hiện tất cả | All modules visible; content filtered by actorId | ✓ |

**User's choice:** D-57 — no role-based module visibility; all modules accessible; views tenant+actor-scoped; action availability state/data-driven.
**Notes:** Inbox shows only tasks for actorId; My Requests only actorId's requests. Approve/Reject only for assigned approver; Publish/Rollback only when applicable. Role-based UI authz deferred.

---

## Visual Identity & Design System

### UI / styling approach

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn/ui + Tailwind | Radix-based copy-in primitives + Tailwind + HSL theme variables | ✓ |
| Component library trọn gói | MUI/Mantine/Chakra | |
| Custom CSS toàn bộ | Hand-built design system | |

**User's choice:** shadcn/ui + Tailwind.

### Premium aesthetic direction

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal / Linear–Vercel style | Deep dark, sharp typography, restrained accent, generous spacing | ✓ |
| Glassmorphism / depth | Blur, gradients, glow, layered shadows | |
| Data-dense enterprise | Console/observability density | |

**User's choice:** Minimal / Linear–Vercel style.

### Theme mode

| Option | Description | Selected |
|--------|-------------|----------|
| Dark-first + light toggle | Dark default with light toggle infra | |
| Chỉ dark-mode | Dark theme only | ✓ |

**User's choice:** Dark-mode only (matches goal).

---

## Policy Editor (Monaco)

### When Monaco validation runs

| Option | Description | Selected |
|--------|-------------|----------|
| Live + chặn khi save | Real-time markers in editor; server re-validates on save/publish | ✓ |
| Chỉ validate khi save | No live markers; validate on save | |

**User's choice:** D-58 — live JSON Schema validation while editing (markers, autocomplete, diagnostics) but advisory only; server-side authoritative; draft save allowed with errors; publish rejected if validation fails; same canonical schema reused.

### Schema source for parity

| Option | Description | Selected |
|--------|-------------|----------|
| Export schema từ runtime core | Use the exact runtime JSON Schema in Monaco | ✓ |
| Schema riêng cho editor | Separate editor schema | |

**User's choice:** D-59 — canonical `PolicyContent` JSON Schema at `src/modules/runtime/schema/policy-content.schema.json` is single source of truth; consumed by Ajv validator, Monaco, future tooling; UI imports via runtime public API; no editor-specific schema; parity rule; schema evolves in one place.

### Lifecycle surfacing in UI

| Option | Description | Selected |
|--------|-------------|----------|
| Version panel cạnh editor | Editor + version/lifecycle panel side-by-side | ✓ |
| Tách trang riêng | Separate authoring + version pages | |
| Bạn quyết định | Defer to research/planning | |

**User's choice:** D-60 — split layout: Monaco (primary) + Lifecycle/Version History panel (secondary), visible simultaneously; draft editable, published read-only, active highlighted; rollback re-points activeVersionId; Publish/Activate/Rollback in panel per state.

---

## Backend wiring scope

### Wiring missing Convex handlers

| Option | Description | Selected |
|--------|-------------|----------|
| Wire đủ endpoint UI cần | Add thin Convex handlers (queries + mutations) calling existing services | ✓ |
| Chỉ wire read | Only queries; reuse existing mutations | |
| Chỉ React | Assume endpoints exist | |

**User's choice:** D-61 — Phase 6 wires all required Convex handlers (queries: policies/versions/requests/inbox/audit; mutations: save-draft/publish/rollback/approve/reject/submit) as thin adapters only; no new domain logic; domain stays in `src/modules/*`.

### Demo data seeding

| Option | Description | Selected |
|--------|-------------|----------|
| Seed script/mutation | Idempotent Convex seed of full demo dataset | ✓ |
| Tạo thủ công qua UI | Manual creation via UI | |
| Bạn quyết định | Defer | |

**User's choice:** D-62 — idempotent demo-data seed (tenants, users, roles, manager hierarchy, policies, versions, requests, approval chains/tasks, audit logs); repeatable/safe to rerun; bootstrap concern, not a business capability; no tenant creation UI.

### Real-time vs manual refresh

| Option | Description | Selected |
|--------|-------------|----------|
| Live (Convex subscriptions) | Reactive queries for inbox/logs/audit/policies | ✓ |
| Manual refresh | Fetch on load/refresh | |

**User's choice:** D-63 — Convex reactive queries for operational views; auto-update; reactivity is UX enhancement not a domain dependency; demo showcases cross-user live flow.

---

## Claude's Discretion

- React build tooling / bundler (e.g. Vite), routing library, Convex React client data-fetching wiring, and folder structure — subject to locked constraints (shadcn/ui + Tailwind, dark-only, thin handlers, schema parity).
- EvaluationContext intake form (raw JSON vs assisted form), execution-trace visualization, and version-diff presentation — not deep-dived; standard approaches acceptable.

## Deferred Ideas

- Authentication / sessions / login / authorization middleware (future phase).
- Role-based UI authorization / module gating.
- Tenant CRUD / administration / onboarding UI.
- Light theme.
- Assisted EvaluationContext form, deep execution-trace visualization, version-diff UI.
