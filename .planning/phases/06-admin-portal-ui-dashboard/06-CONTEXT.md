# Phase 6: Admin Portal & UI Dashboard - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 delivers a **highly premium, dark-mode React web client** that acts as a **front-end consumer** of the existing Convex/runtime backend. It is the first UI over the platform built in Phases 1–5.

**Four UI modules (UI-01..04):**

- **Admin Policy Portal (UI-01)** — Monaco JSON editor with live, schema-driven autocomplete + error hints, plus a lifecycle/version-history panel (draft → publish → activate → rollback).
- **Request Center (UI-02)** — submit `EvaluationContext` payloads and view execution logs / decision states.
- **Personal Inbox (UI-03)** — approver dashboard listing tasks assigned to the active user, with state-driven Approve/Reject actions.
- **Governance Viewer (UI-04)** — audit trails and comparative policy-version lists.

**Phase 6 ALSO includes (necessary backend glue, not new domain capability):**

- **Wiring all missing thin Convex handlers** the UI needs (D-61). Today only `directory` + `request` have handlers; `convex/policy.ts` and `convex/audit.ts` are empty stubs (`export {}`) and `approval` has none. Handlers remain thin DI adapters per the project HARD RULE — they parse args, build `TenantContext`, assemble dependencies, call the existing `src/modules/*` application services, and map the response. **No domain logic** (evaluation, routing, lifecycle, business rules) may be added in `convex/`.
- **An idempotent demo-data seed mechanism** (D-62) to populate the Demo Context Selector and deterministic demo scenarios.

**Phase 6 IS NOT:**

- **Authentication / sessions / login / authorization middleware** — replaced by a Demo Context Selector (D-55). Auth deferred to a future phase.
- **Role-based UI authorization / module gating** (D-57) — deferred.
- **Tenant CRUD / admin / onboarding UI** (D-56) — the demo dataset is fixed and seeded.
- **New domain logic of any kind** — all domain behavior stays in `src/modules/*`; Convex handlers stay thin (HARD RULE, D-61).
- **A light theme** — dark-mode only per the phase goal.

</domain>

<decisions>
## Implementation Decisions

### Identity & Tenant Context

- **D-55 — Demo Context Selector instead of authentication.** The UI exposes an **Active Tenant selector** and an **Active User selector**; the selection populates `TenantContext { tenantId, actorId }`, which every application service consumes exactly as production code would. Non-goals: authentication, sessions, passwords, login flows, authorization middleware. Authentication is deferred to a future phase.
- **D-56 — Switch between multiple seeded tenants.** The User selector is filtered by the selected tenant. All queries execute with the selected `tenantId`; all services receive `TenantContext` from the current selection. Switching tenants reloads policies, requests, approvals, audits, and users. Demonstrates CON-01 logical isolation and tenant-scoped repositories. Non-goals: tenant CRUD/administration/onboarding. Phase 6 uses a fixed seeded set of demo tenants.
- **D-57 — No role-based module visibility.** All users can access Policies / Requests / Inbox / Audit. Views remain **tenant-scoped and actor-scoped**: Inbox shows only tasks assigned to `actorId`; "My Requests" shows only requests created by `actorId`. **Action availability is state/data-driven** — Approve/Reject appear only for the assigned approver; Publish/Rollback appear only when the lifecycle state allows. Role-based UI authorization is deferred.

### Visual Identity & Design System

- **D-V1 — shadcn/ui + Tailwind.** Radix-based copy-in component primitives with Tailwind and CSS HSL variables for theming. Chosen for high control over a consistent "premium" look and clean Monaco integration.
- **D-V2 — Minimal / Linear–Vercel aesthetic.** Deep dark surfaces, sharp typography, restrained accent color, generous spacing, light micro-interactions.
- **D-V3 — Dark-mode only.** No light theme in this phase (matches the goal statement). HSL-variable infrastructure may make a future light theme cheap, but it is out of scope now.

### Policy Editor (Monaco)

- **D-58 — Live, advisory Monaco validation; server is authoritative.** Monaco performs live JSON Schema validation while editing (real-time error markers, schema-aware autocomplete, inline diagnostics), but it is **advisory only**. Draft save is allowed even with validation errors. On publish, the runtime validator executes server-side and **publish is rejected if validation fails**. The same canonical JSON Schema artifact is reused by both Monaco and the runtime validator.
- **D-59 — Single canonical schema as the source of truth.** The canonical `PolicyContent` JSON Schema lives at `src/modules/runtime/schema/policy-content.schema.json` and is consumed by the Ajv runtime validator, the Monaco JSON language service, and future tooling. The UI imports the schema artifact via the runtime module's public API. **No editor-specific schema definitions are allowed.** Parity rule: if the runtime validation accepts a document, Monaco must accept it; if the runtime rejects it, Monaco must reject it. Schema evolution happens in one place only. *(Implementation note: the schema JSON is not yet exported from the runtime barrel `src/modules/runtime/index.ts` — Phase 6 must expose it through the public API.)*
- **D-60 — Split layout: editor + lifecycle/version-history panel.** Monaco editor is the primary area; a Lifecycle / Version History panel is the secondary area, visible simultaneously. The panel shows draft state, the active version, published versions, and version metadata. Draft is editable; published versions are read-only; active status is visually highlighted. **Rollback changes `activeVersionId` rather than modifying historical versions.** Publish / Activate / Rollback actions are surfaced in the version panel according to lifecycle state, reinforcing version immutability.

### Backend Wiring Scope

- **D-61 — Phase 6 wires all Convex handlers required by the UI (thin adapters only).** Queries: `policies`, `versions`, `requests`, `inbox`, `audit logs`. Mutations: `save draft`, `publish policy`, `rollback policy`, `approve task`, `reject task`, `submit request`. Each handler only: parses args, builds `TenantContext`, assembles dependencies, calls the application service, returns the result. Forbidden in handlers: business rules, policy evaluation logic, approval routing logic, lifecycle logic. All domain behavior remains in `src/modules/*`. Phase 6 may add handlers but must not introduce new domain logic.
- **D-62 — Idempotent demo-data seed mechanism.** Seeds tenants, users, roles, manager hierarchy, policies, policy versions, request evaluations, approval chains/tasks, and audit logs. Must be repeatable, idempotent, and safe to rerun. It is an environment/bootstrap concern, not a business capability. No tenant-creation UI is introduced; Phase 6 assumes a fixed seeded demo dataset.
- **D-63 — Convex reactive queries for operational views.** Approval Inbox, Request Logs, Audit Timeline, and Policy Lists update automatically when underlying data changes; no manual refresh for normal operation. Reactivity is a UX enhancement, not a domain dependency — domain correctness remains server-side, and a dropped subscription may temporarily stale the UI but must never affect business behavior. Demo scenarios should showcase cross-user updates: requester submits → approver inbox updates → approver acts → requester status updates → audit timeline updates.

### Claude's Discretion

- React build tooling, project layout/bundler (e.g. Vite), routing library, state/data-fetching wiring around the Convex React client, and folder structure are left to research/planning — subject to the constraints above (shadcn/ui + Tailwind, dark-only, thin Convex handlers, schema parity).
- Exact composition of EvaluationContext intake (raw JSON vs assisted form), execution-trace visualization, and version-diff presentation were not deep-dived — open to standard approaches consistent with the minimal/Linear aesthetic.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level decisions & requirements
- `.planning/PROJECT.md` — architecture (Hexagonal + Modular Monolith), the **Convex HARD RULE** (handlers are thin DI assembly only), TenantContext constraint, domain-neutrality, Concept Hierarchy (UI is concept #10, a front-end consumer).
- `.planning/REQUIREMENTS.md` — UI-01..04 definitions (Admin Policy Portal, Request Log, Personal Inbox, Governance Viewer).
- `.planning/ROADMAP.md` §"Phase 6" — goal, success criteria, and the 3 planned sub-plans (06-01 routes/layout/dark-mode HSL vars, 06-02 Monaco portal, 06-03 logs/inbox/governance).

### Upstream phase context (consumed by the UI)
- `.planning/phases/05-approval-routing/05-CONTEXT.md` — `ApprovalChain` / `ApprovalTask` entities, state machine, `requesterId`/`actorId` (D-47/D-48), `EventDispatcher` semantics. The Inbox and approval actions bind to this consumer.

### Canonical schema (single source of truth — D-59)
- `src/modules/runtime/schema/policy-content.schema.json` — the authoritative `PolicyContent` JSON Schema for both the runtime Ajv validator and the Monaco editor. **Must be exposed via the runtime barrel** (`src/modules/runtime/index.ts`) for UI import.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Application services already built** (`src/modules/*/application/`): `policy-service.ts`, `approval-routing-service.ts`, `policy-runtime-service.ts`, `role-service.ts`, `user-service.ts`. The UI's Convex handlers call these — no new domain logic needed.
- **Existing thin Convex handlers as templates**: `convex/directory.ts` (`createTenant`, `createRole`, `getRole`, `createUser`, `assignRole`, `setManager`) and `convex/request.ts` (`submitRequest`, `getRequestEvaluation`) show the exact thin-handler shape (parse → build TenantContext → call service → map result) to mirror for the new policy/audit/approval handlers.
- **Canonical JSON Schema**: `src/modules/runtime/schema/policy-content.schema.json` drives both runtime validation and Monaco autocomplete (D-59).
- **Convex schema tables already defined** (`convex/schema.ts`): `tenants`, `users`, `roles`, `policies`, `policyVersions`, `auditLogs`, `requestEvaluations`, `approvalChains`, `approvalTasks` — all tenant-prefixed. The UI reads/writes these via new handlers; no schema changes expected beyond what handlers need.

### Established Patterns
- **Convex HARD RULE** — handlers are thin DI assembly only; no domain logic in `convex/` (PROJECT.md, reaffirmed by D-61).
- **TenantContext-first** — every service method takes `ctx: TenantContext` ({tenantId, actorId}) as its first parameter; the Demo Context Selector is the UI's way of producing this (D-55).
- **Module boundaries** — cross-module access only via barrels (`index.ts`); ESLint `import/no-restricted-paths` zones enforce this. UI/handlers consume runtime/policy/approval/audit only through their public APIs.
- **Branded IDs + ES-module `.js` import extensions** — used throughout `src/modules/*`.

### Integration Points
- **New thin Convex handlers** (D-61) in `convex/policy.ts` (currently stub), `convex/audit.ts` (currently stub), and an approval handler (none yet) — queries: policies/versions/requests/inbox/audit; mutations: save-draft/publish/rollback/approve/reject/submit.
- **Runtime barrel export** — expose `policy-content.schema.json` via `src/modules/runtime/index.ts` so the UI can import the canonical schema (D-59).
- **Demo seed** (D-62) — an idempotent Convex seed mutation/script populating the full demo dataset (tenants → users w/ managerId hierarchy → roles → policies/versions → requests → approval chains/tasks → audit logs).
- **Convex React client** — the UI uses Convex reactive queries for live operational views (D-63).

</code_context>

<specifics>
## Specific Ideas

- **"Premium" = minimal Linear/Vercel dark UI** (D-V2): deep dark surfaces, sharp typography, restrained accent, generous spacing, subtle micro-interactions — not glassmorphism, not data-dense console.
- **Schema parity is a hard invariant** (D-59): editor and server must accept/reject identically because they share one schema artifact. This is the concrete proof that the runtime stays the single source of validation truth.
- **Live cross-user demo flow** (D-63): the showcase scenario is requester submits → approver inbox updates → approver acts → requester status updates → audit timeline updates, all without manual refresh.
- **State-driven actions, not role gates** (D-57): the UI shows Approve/Reject only to the assigned approver and Publish/Rollback only when lifecycle state permits — authorization is expressed through data/state, not a permission layer.
- **Rollback = re-point active version** (D-60): never mutate historical versions; rollback changes `activeVersionId`, preserving immutability.

</specifics>

<deferred>
## Deferred Ideas

These surfaced during discussion but belong to other phases / v2. Not scope creep — captured so they aren't lost.

- **Authentication, sessions, login flows, authorization middleware** — deferred to a future phase (D-55). Phase 6 uses the Demo Context Selector.
- **Role-based UI authorization / module gating** — deferred (D-57). Phase 6 keeps all modules visible and uses state/data-driven action availability.
- **Tenant CRUD / administration / onboarding UI** — out of scope (D-56). Phase 6 uses a fixed seeded demo dataset.
- **Light theme** — out of scope (D-V3); dark-mode only for now.
- **EvaluationContext assisted/dynamic intake form, execution-trace deep visualization, version-diff UI** — not deep-dived; left to research/planning to fill with standard approaches if not already obvious.

</deferred>

---

*Phase: 6-Admin Portal & UI Dashboard*
*Context gathered: 2026-06-04*
