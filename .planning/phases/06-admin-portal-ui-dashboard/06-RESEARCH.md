# Phase 6: Admin Portal & UI Dashboard - Research

**Researched:** 2026-06-04
**Domain:** React frontend (Vite + shadcn/ui + Tailwind v4 + Monaco) over an existing Convex backend; thin Convex handler wiring; idempotent demo seed
**Confidence:** HIGH (stack, backend wiring, architecture); MEDIUM (Monaco schema-feed exact API surface, version pins for fast-moving libs)

## Summary

Phase 6 is a **greenfield React frontend bolted onto a mature backend**. The backend (Convex 1.40.0 in the existing `convex/` folder, plus `src/modules/*` hexagonal application services) is complete for Phases 1–5; Phase 6 adds (a) a Vite + React 19 + shadcn/ui dark-only client, (b) the missing **thin Convex handlers** the UI calls (D-61 — `convex/policy.ts`, `convex/audit.ts`, and a new approval handler are empty/absent today), (c) **new repository "list" methods** that do not yet exist (the UI needs to list policies, versions, and inbox tasks — see the critical gap below), (d) **exposing `policy-content.schema.json` through the runtime barrel** (D-59), and (e) an **idempotent demo seed** (D-62).

The single largest non-obvious risk is **missing read/list capabilities in the existing ports**. The repositories were built for the write/evaluate paths of Phases 1–5; they have `findById`, `findByRequestType`, `findDraftByPolicy`, `findByChainId`, `findByTenant` (request evals + audit), but they **lack** the list-by-tenant methods the four UI modules need: "list all policies for a tenant," "list all versions of a policy," and "list inbox tasks assigned to an approver." Adding these is repository + port + Convex-adapter work, and per the Convex HARD RULE the *query logic* (index selection, tenant scoping) lives in the adapter, not in `convex/`. This must be planned explicitly or the UI cannot render.

The second integration subtlety: the repo already uses the `@/*` path alias to mean `src/*` (backend) and `convex/` already exists. The Vite frontend must be added without colliding with these. Recommended: put the React app under `web/` (or `app/`) with its own `tsconfig`, its own Vite config, and run `convex dev` against the existing `convex/` folder (no re-init). The frontend imports the canonical schema from the runtime barrel and the generated Convex API from `convex/_generated/api`.

**Primary recommendation:** Add a Vite + React 19 app in a dedicated frontend directory (`web/`), wire it to the existing Convex deployment via `VITE_CONVEX_URL` + `ConvexProvider`. Plan 06-01 = scaffold + shadcn init + dark HSL theme + routes/shell + Demo Context Selector. Plan 06-02 = expose schema via barrel + new policy/version list methods + thin policy handlers + Monaco portal. Plan 06-03 = audit/approval list methods + thin handlers + Logs/Inbox/Governance views + idempotent seed. Use `take(n)`/`order("desc")` (not unbounded `.collect()`) in every list query.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-55 — Demo Context Selector instead of authentication.** UI exposes Active Tenant + Active User selectors; selection populates `TenantContext { tenantId, actorId }` consumed by every service. No auth/sessions/login/authorization middleware. Auth deferred.
- **D-56 — Switch between multiple seeded tenants.** User selector filtered by selected tenant; all queries run with selected `tenantId`; switching tenant reloads policies/requests/approvals/audits/users. Demonstrates CON-01 isolation. No tenant CRUD/onboarding — fixed seeded set.
- **D-57 — No role-based module visibility.** All users access Policies/Requests/Inbox/Audit. Views are tenant- and actor-scoped (Inbox = tasks for `actorId`; My Requests = requests by `actorId`). Action availability is state/data-driven (Approve/Reject only for assigned approver; Publish/Rollback only when lifecycle allows).
- **D-V1 — shadcn/ui + Tailwind.** Radix copy-in primitives, Tailwind, CSS HSL variables for theming.
- **D-V2 — Minimal Linear/Vercel aesthetic.** Deep dark surfaces, sharp typography, restrained accent, generous spacing, light micro-interactions.
- **D-V3 — Dark-mode only.** No light theme this phase. HSL infra may enable cheap future light theme but out of scope.
- **D-58 — Live, advisory Monaco validation; server is authoritative.** Monaco does live JSON Schema validation/autocomplete/diagnostics, advisory only. Draft save allowed with errors. On publish, server runtime validator runs and rejects on failure. Same canonical schema reused by both.
- **D-59 — Single canonical schema as source of truth.** `src/modules/runtime/schema/policy-content.schema.json` consumed by Ajv runtime validator AND Monaco. UI imports it via the runtime module's public API. No editor-specific schema. Parity rule: runtime-accept ⇔ Monaco-accept. **(Schema JSON not yet exported from `src/modules/runtime/index.ts` — Phase 6 must expose it.)**
- **D-60 — Split layout: editor + lifecycle/version-history panel.** Monaco primary; lifecycle/version panel secondary, simultaneously visible. Draft editable; published read-only; active highlighted. Rollback re-points `activeVersionId`, never mutates history. Publish/Activate/Rollback surfaced per lifecycle state.
- **D-61 — Phase 6 wires all Convex handlers required by the UI (thin adapters only).** Queries: policies, versions, requests, inbox, audit logs. Mutations: save draft, publish, rollback, approve, reject, submit. Each handler only parses args, builds `TenantContext`, assembles dependencies, calls the application service, returns result. Forbidden in handlers: business rules, policy evaluation, approval routing, lifecycle logic. No new domain logic anywhere.
- **D-62 — Idempotent demo-data seed mechanism.** Seeds tenants, users, roles, manager hierarchy, policies, versions, request evaluations, approval chains/tasks, audit logs. Repeatable, idempotent, safe to rerun. Bootstrap concern, not a business capability. No tenant-creation UI.
- **D-63 — Convex reactive queries for operational views.** Inbox, Request Logs, Audit Timeline, Policy Lists update automatically; no manual refresh. Reactivity is UX enhancement, not domain dependency. Showcase cross-user flow: requester submits → approver inbox updates → approver acts → requester status updates → audit timeline updates.

### Claude's Discretion

- React build tooling, project layout/bundler (e.g. Vite), routing library, state/data-fetching wiring around the Convex React client, folder structure — subject to constraints above (shadcn/ui + Tailwind, dark-only, thin handlers, schema parity).
- Exact composition of EvaluationContext intake (raw JSON vs assisted form), execution-trace visualization, and version-diff presentation — open to standard approaches consistent with the minimal/Linear aesthetic.

### Deferred Ideas (OUT OF SCOPE)

- Authentication, sessions, login flows, authorization middleware (D-55).
- Role-based UI authorization / module gating (D-57).
- Tenant CRUD / administration / onboarding UI (D-56).
- Light theme (D-V3).
- EvaluationContext assisted/dynamic intake form, execution-trace deep visualization, version-diff UI (not deep-dived; standard approaches if not obvious).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Admin Policy Portal: Monaco JSON editor with schema autocomplete + lifecycle/version panel | Monaco schema-feed via `setDiagnosticsOptions` (Architecture Pattern 4); split layout via shadcn `resizable`/grid; new policy + version list methods + thin policy handlers; schema exported from runtime barrel |
| UI-02 | Request Log: submit EvaluationContext, view evaluation/decision states | Existing `submitRequest` handler reusable; `getRequestEvaluation` exists; need a *list* requests-by-tenant handler over existing `findByTenant`; trace already stored on `requestEvaluations.trace` |
| UI-03 | Personal Inbox: approver pending tasks + Approve/Reject | **Gap:** no list-tasks-by-approver method exists — must add port + adapter; `ApprovalRoutingService.act(ctx, taskId, "APPROVE"|"REJECT")` already implemented; new approval handlers wire it |
| UI-04 | Governance Viewer: version histories + step-by-step decision logs | `auditLogs.findByTenant` exists (audit timeline); version history needs new list-versions-by-policy method; decision trace on `requestEvaluations.trace` |

## Project Constraints (from CLAUDE.md)

> CLAUDE.md is primarily GitNexus tooling guidance, not code conventions. The architectural constraints below come from PROJECT.md (treated with the same authority as locked decisions).

- **GitNexus discipline (CLAUDE.md):** Before editing any existing symbol, run `gitnexus_impact({target, direction:"upstream"})`; warn on HIGH/CRITICAL. Run `gitnexus_detect_changes()` before commit. Use `gitnexus_rename` for renames, never find-and-replace. Re-run `npx gitnexus analyze` after commits (a PostToolUse hook does this automatically). *Note: this matters for Phase 6 mostly when adding methods to existing ports/adapters (PolicyVersionRepositoryPort, ApprovalTaskRepositoryPort) — run impact analysis on the existing repository classes before extending them.*
- **Convex HARD RULE (PROJECT.md, D-61):** Handlers in `convex/` are exclusively thin DI assembly — validate input shape, instantiate deps, call services, map responses. NO domain logic, evaluation, business rules, approval routing, or lifecycle logic in `convex/`. *(Query index selection and tenant-scoped filtering belong in the Convex **adapter** under `src/modules/*/adapters/convex/`, not in the handler.)*
- **TenantContext Constraint (PROJECT.md, D-19):** `TenantContext` is the explicit first parameter to every service method. No ambient resolution (no AsyncLocalStorage, no globals). The Demo Context Selector is the UI's way of producing `{ tenantId, actorId }`.
- **Module Boundary Rule (ESLint `import/no-restricted-paths`):** Cross-module access only via barrel `index.ts`. `convex/` may deep-import `./adapters/convex/**` for DI wiring, and `./domain/ids.ts`, but must import services/contexts/errors only through `@/modules/<mod>` barrels. (Verified in `eslint.config.js`.)
- **Domain-Neutrality:** No HR-specific code in the domain. `EvaluationContext` stays structurally-typed key/value.
- **Security:** No `eval()` / dynamic code execution. (Monaco editing JSON text is fine; the JSON is `JSON.parse`d, never executed.)
- **Testing:** 100% coverage on runtime + approval modules; 90%+ on critical logic. Convex adapters are **excluded** from coverage (`vitest.config.ts` excludes `src/modules/**/adapters/convex/**`). New list methods on adapters won't be coverage-gated but should still be tested.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Render policy editor, version panel, inbox, logs, governance views | Browser / Client (React) | — | Pure presentation; consumes reactive query results |
| Demo Context Selector → `{tenantId, actorId}` | Browser / Client (React state/context) | — | Replaces auth (D-55); selection drives every query's args |
| Live JSON schema validation while typing | Browser / Client (Monaco JSON language service) | — | Advisory only (D-58); fed the canonical schema artifact |
| Reactive subscriptions (inbox/logs/audit/policy lists auto-update) | Convex (server) → Client (`useQuery`) | — | Convex push-based reactivity (D-63); client just subscribes |
| Parse args, build `TenantContext`, assemble DI, map response | API / Backend (`convex/` handlers) | — | Thin adapter only (HARD RULE, D-61) |
| Policy lifecycle (draft/publish/rollback), approval act, evaluation | API / Backend (`src/modules/*/application`) | — | All domain logic stays in application services |
| Tenant-scoped list queries (index selection, filtering) | API / Backend (`src/modules/*/adapters/convex`) | — | Query mechanics belong in the adapter, NOT the handler |
| Authoritative schema validation on publish | API / Backend (Ajv runtime validator) | — | Server is source of truth (D-58); Monaco is advisory |
| Persistence | Database / Storage (Convex tables) | — | Schema already defined in `convex/schema.ts` |
| Canonical schema artifact (single source) | API/Backend artifact, imported by both tiers | — | One JSON file feeds Ajv (server) and Monaco (client) via runtime barrel (D-59) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` + `react-dom` | 19.2.7 | UI runtime | [VERIFIED: npm registry] Required by shadcn/ui; React 19 is current stable |
| `vite` | 8.0.16 | Dev server + bundler | [VERIFIED: npm registry] Convex's recommended React setup uses Vite [CITED: docs.convex.dev/quickstart/react]; shadcn has a first-class Vite guide |
| `@vitejs/plugin-react` | 6.0.2 | React fast-refresh in Vite | [VERIFIED: npm registry] Standard Vite React plugin |
| `convex` | 1.40.0 (repo pins 1.39.1) | Backend client + server | [VERIFIED: npm registry] Already a dependency; provides `convex/react` (`ConvexProvider`, `useQuery`, `useMutation`) |
| `tailwindcss` | 4.3.0 | Utility CSS + HSL token theming | [VERIFIED: npm registry] Locked D-V1; shadcn Vite guide uses Tailwind v4 |
| `@tailwindcss/vite` | 4.3.0 | Tailwind v4 Vite plugin (replaces PostCSS config) | [CITED: ui.shadcn.com/docs/installation/vite] Tailwind v4 integrates via this plugin + `@import "tailwindcss"` |
| `@monaco-editor/react` | 4.7.0 | React wrapper for Monaco; lazy-loads `monaco-editor` | [VERIFIED: npm registry] Standard React Monaco integration; exposes `beforeMount(monaco)` for schema config |
| `monaco-editor` | 0.55.1 | The editor + JSON language service | [VERIFIED: npm registry] Peer of the wrapper; provides `languages.json.jsonDefaults.setDiagnosticsOptions` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-router-dom` | 7.16.0 | Client routing for the 4 modules | [VERIFIED: npm registry] Standard SPA routing; Claude's discretion (D-V routing) |
| `lucide-react` | 1.17.0 | Icon set (shadcn default) | [VERIFIED: npm registry] UI-SPEC locks `lucide-react`. Note: 1.x is current `latest` (project graduated from 0.x); not a typo |
| `class-variance-authority` | 0.7.1 | Variant styling for shadcn components | [VERIFIED: npm registry] Installed by shadcn components automatically |
| `clsx` | 2.1.1 | className composition (`cn` helper) | [VERIFIED: npm registry] shadcn `lib/utils.ts` dependency |
| `tailwind-merge` | 3.6.0 | Merge conflicting Tailwind classes | [VERIFIED: npm registry] shadcn `cn` helper dependency |
| `sonner` | 2.0.7 | Toast notifications (publish/reject feedback) | [VERIFIED: npm registry] UI-SPEC registry list includes `sonner` |
| `@types/react` / `@types/react-dom` | 19.2.16 / matching | TS types | [VERIFIED: npm registry] Dev deps for React 19 |

### Test / Dev (if Convex handler integration tests desired)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `convex-test` | 0.0.53 | In-memory Convex function test harness | [VERIFIED: npm registry] Optional — only if Plan adds handler-level tests beyond the existing fake-db unit pattern. Pre-1.0 (0.0.x) — treat as MEDIUM stability |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vite | Next.js | Next adds SSR/routing weight the demo doesn't need; Convex's React quickstart and shadcn both default to Vite for SPAs. Vite is simpler for a backend-already-exists scenario |
| `react-router-dom` | TanStack Router, file-based routing | Overkill for 4 static routes; react-router is the lowest-friction choice |
| `@monaco-editor/react` | `react-monaco-editor` | The `@monaco-editor/react` wrapper lazy-loads Monaco from CDN/bundle and exposes `beforeMount`/`onMount` hooks needed to call `setDiagnosticsOptions` before the model mounts; it is the more actively used modern wrapper |
| Convex reactive `useQuery` for lists | REST/polling | D-63 locks reactive queries; polling would violate the no-manual-refresh contract |

**Installation (run inside the frontend dir, e.g. `web/`):**
```bash
# Scaffold (Claude's discretion on dir name; web/ avoids colliding with src/ and convex/)
npm create vite@latest web -- --template react-ts

# Frontend deps
npm install convex react-router-dom @monaco-editor/react monaco-editor \
  lucide-react class-variance-authority clsx tailwind-merge sonner
npm install -D tailwindcss @tailwindcss/vite @types/react @types/react-dom

# shadcn init (New York style, base color Zinc, CSS variables = yes, dark default) per UI-SPEC
npx shadcn@latest init

# shadcn blocks listed in UI-SPEC registry-safety table
npx shadcn@latest add button card dialog select table badge input textarea \
  tabs separator scroll-area tooltip dropdown-menu skeleton sonner
```

**Version verification:** All core/supporting packages confirmed via `npm view <pkg> version` on 2026-06-04 (see Package Legitimacy Audit). The repo currently pins `convex` at 1.39.1; the frontend can use the same pin (do not silently bump the backend's Convex version — keep frontend and backend on the same Convex major/minor to avoid `_generated/api` drift).

## Package Legitimacy Audit

> slopcheck 0.6.1 only supports **PyPI**; it has no npm registry mode (`--registry npm` is rejected). Its `[SLOP]` verdicts for these packages are **ecosystem mismatches** ("does not exist on pypi"), not genuine hallucination signals — every package below is a well-known npm package. Per the protocol's ecosystem-specific rule, the authoritative check for npm packages is `npm view` + discovery from official docs (Convex quickstart, shadcn Vite guide). All packages verified present on npm with sane versions and **zero postinstall scripts**.

| Package | Registry | Version | Source Repo | npm verified | postinstall | Disposition |
|---------|----------|---------|-------------|--------------|-------------|-------------|
| react | npm | 19.2.7 | facebook/react | ✓ | none | Approved |
| react-dom | npm | 19.2.7 | facebook/react | ✓ | none | Approved |
| vite | npm | 8.0.16 | vitejs/vite | ✓ | none | Approved |
| @vitejs/plugin-react | npm | 6.0.2 | vitejs/vite-plugin-react | ✓ | none | Approved |
| convex | npm | 1.40.0 (pin 1.39.1) | get-convex/convex-js | ✓ (already a dep) | none | Approved |
| @monaco-editor/react | npm | 4.7.0 | suren-atoyan/monaco-react | ✓ | none | Approved |
| monaco-editor | npm | 0.55.1 | microsoft/monaco-editor | ✓ | none | Approved |
| tailwindcss | npm | 4.3.0 | tailwindlabs/tailwindcss | ✓ | none | Approved |
| @tailwindcss/vite | npm | 4.3.0 | tailwindlabs/tailwindcss | ✓ | none | Approved |
| react-router-dom | npm | 7.16.0 | remix-run/react-router | ✓ | none | Approved |
| lucide-react | npm | 1.17.0 | lucide-icons/lucide | ✓ (latest dist-tag) | none | Approved |
| class-variance-authority | npm | 0.7.1 | joe-bell/cva | ✓ | none | Approved |
| clsx | npm | 2.1.1 | lukeed/clsx | ✓ | none | Approved |
| tailwind-merge | npm | 3.6.0 | dcastil/tailwind-merge | ✓ | none | Approved |
| sonner | npm | 2.0.7 | emilkowalski/sonner | ✓ | none | Approved |
| tailwindcss-animate | npm | 1.0.7 | jamiebuilds/tailwindcss-animate | ✓ | none | Approved (only if a shadcn component pulls it; Tailwind v4 + `tw-animate-css` may supersede — let `shadcn init` decide) |
| convex-test | npm | 0.0.53 | get-convex/convex-test | ✓ | none | Optional / Approved (pre-1.0 — MEDIUM stability) |

**Packages removed due to slopcheck [SLOP] verdict:** none (all SLOP verdicts were PyPI ecosystem mismatches; npm is the correct registry).
**Packages flagged as suspicious [SUS]:** none on npm. (slopcheck flagged `monaco-editor` as SUS *on PyPI* — a different, unrelated PyPI package — irrelevant here.)

## Architecture Patterns

### System Architecture Diagram

```
                          BROWSER (React SPA, dark-only)
   ┌──────────────────────────────────────────────────────────────────────┐
   │  Demo Context Selector ──► AppContext { tenantId, actorId }            │
   │        (D-55) selection injected as args into EVERY query/mutation     │
   │                                                                        │
   │  Left nav rail (4 modules, all visible — D-57)                         │
   │   ├─ Policy Portal (UI-01)  Monaco(editor) | VersionPanel(lifecycle)   │
   │   │      Monaco JSON lang svc ◄── canonical schema (imported)          │
   │   ├─ Request Center (UI-02) raw JSON intake | live decision log        │
   │   ├─ Personal Inbox (UI-03) tasks for actorId | Approve/Reject         │
   │   └─ Governance (UI-04)     audit timeline | version history           │
   │                                                                        │
   │  convex/react: useQuery (reactive, D-63) ▲   useMutation ▼             │
   └──────────┬──────────────────────────────────────┬─────────────────────┘
        subscribe (push updates)                  invoke
              │                                        │
   ┌──────────▼────────────────────────────────────────▼────────────────────┐
   │  convex/  THIN HANDLERS (D-61: parse args → build TenantContext         │
   │           → assemble DI → call service → map response. NO domain logic) │
   │   policy.ts: listPolicies, listVersions, saveDraft, publish, rollback   │
   │   approval.ts: listInbox, approve, reject                               │
   │   audit.ts: listAuditLogs                                               │
   │   request.ts: submitRequest (exists), listRequests (new), getEval(exists)│
   │   seed.ts: internalMutation seedDemoData (idempotent, D-62)             │
   └──────────┬──────────────────────────────────────────────────────────────┘
              │ calls (TenantContext first arg)
   ┌──────────▼──────────────────────────────────────────────────────────────┐
   │  src/modules/*/application  (ALL domain logic — unchanged behavior)      │
   │   PolicyService · ApprovalRoutingService · PolicyRuntimeService · ...    │
   │           │ depends on ports                                            │
   │  src/modules/*/adapters/convex  (query mechanics: index + tenant scope) │
   │   ◄── NEW list methods added here (see Don't-Hand-Roll / gap)           │
   │  src/modules/runtime: validateAndEvaluate (authoritative on publish)    │
   │  src/modules/runtime/schema/policy-content.schema.json (single source)  │
   └──────────┬──────────────────────────────────────────────────────────────┘
              │
   ┌──────────▼─────────────────┐
   │  Convex DB (schema.ts)     │  tenant-prefixed indexes already defined
   └────────────────────────────┘
```

### Recommended Project Structure
```
mini-stry/
├── convex/                 # EXISTING backend — add handlers here (thin only)
│   ├── policy.ts           # stub → list/save/publish/rollback handlers
│   ├── audit.ts            # stub → listAuditLogs handler
│   ├── approval.ts         # NEW → listInbox/approve/reject handlers
│   ├── request.ts          # add listRequests handler
│   ├── seed.ts             # NEW → internalMutation seedDemoData (D-62)
│   └── schema.ts           # unchanged (tables already defined)
├── src/modules/            # EXISTING — add LIST methods to ports + adapters
│   └── runtime/index.ts    # ADD: export the canonical schema JSON (D-59)
└── web/                    # NEW frontend (own tsconfig + vite.config)
    ├── components.json      # shadcn config (New York, Zinc, CSS vars)
    ├── vite.config.ts       # @vitejs/plugin-react + @tailwindcss/vite + alias
    ├── src/
    │   ├── main.tsx         # ConvexProvider + ConvexReactClient(VITE_CONVEX_URL)
    │   ├── app/context/      # DemoContext (tenantId, actorId)
    │   ├── routes/           # PolicyPortal, RequestCenter, Inbox, Governance
    │   ├── components/ui/    # shadcn copy-in primitives
    │   ├── features/policy/  # Monaco editor + version panel
    │   └── lib/              # cn(), monaco schema setup, convex hooks
    └── index.css            # @import "tailwindcss"; + .dark HSL tokens
```

### Pattern 1: Add the Vite frontend without colliding with the existing backend
**What:** The repo already has `convex/` and uses `@/*` → `src/*` for the backend. Do NOT run `npx convex dev` from scratch (it would try to re-init); the deployment already exists. Put the React app in its own directory with its own configs.
**When to use:** Always — this is the integration spine for Phase 6.
**Key points:**
- Frontend gets its own `web/tsconfig.json` with `paths: { "@/*": ["./src/*"] }` scoped to `web/src` (does NOT conflict with the root `@/*` because it is a separate tsconfig/Vite root).
- Frontend imports the generated Convex API from the **repo-root** `convex/_generated/api` (relative import or a dedicated alias like `@convex`). The generated API is produced by the running Convex dev server pointed at the existing `convex/` folder.
- `VITE_CONVEX_URL` (in `web/.env.local`) connects the client to the deployment. [CITED: docs.convex.dev/quickstart/react]

```typescript
// web/src/main.tsx — Source: docs.convex.dev/quickstart/react (adapted)
import { ConvexProvider, ConvexReactClient } from "convex/react";
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ConvexProvider client={convex}>
    <App />
  </ConvexProvider>,
);
```

### Pattern 2: Demo Context Selector → every query/mutation carries `{tenantId, actorId}`
**What:** A React context holds the selected `tenantId` + `actorId`. Every `useQuery`/`useMutation` call passes these as args; the handler turns them into `TenantContext` server-side. This mirrors production exactly (D-55) and keeps the tenant boundary explicit (no ambient resolution).
**When to use:** Every operational view.
**Example:**
```typescript
// web/src/features/inbox/Inbox.tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api"; // root convex/
import { useDemoContext } from "@/app/context/DemoContext";

function Inbox() {
  const { tenantId, actorId } = useDemoContext();
  const tasks = useQuery(api.approval.listInbox, { tenantId, actorId }); // reactive (D-63)
  const approve = useMutation(api.approval.approve);
  // Approve button shown only when task.approverId === actorId (D-57 state/data-driven)
  // approve({ tenantId, actorId, taskId })
}
```

### Pattern 3: Thin Convex handler (mirror `convex/request.ts` / `convex/directory.ts`)
**What:** Handlers only parse args, build `TenantContext`, instantiate adapters + service via DI, call the service, return the result. Index/scope logic stays in the adapter.
**When to use:** Every new handler (policy/audit/approval/request-list).
**Example (new policy list handler):**
```typescript
// convex/policy.ts — Source: mirror of convex/directory.ts (verified existing template)
import { query, mutation } from "./_generated/server.js";
import { v } from "convex/values";
import { ConvexPolicyRepository } from "../src/modules/policy/adapters/convex/convex-policy-repository.js";
import { tenantContext, tenantId } from "../src/modules/directory/index.js";

export const listPolicies = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    const repo = new ConvexPolicyRepository(ctx.db);
    const tCtx = tenantContext(tenantId(args.tenantId));
    return repo.listByTenant(tCtx); // NEW adapter method — see gap below
  },
});
```
**Approval act handler** wires the already-implemented `ApprovalRoutingService.act(ctx, taskId, "APPROVE"|"REJECT")` (verified signature). Because `act` enforces `ctx.actorId === task.approverId` and throws `UnauthorizedApproverError`, the handler must build `TenantContext` with **both** `tenantId` and `actorId`. The full DI graph for approval mutations (chainRepo, taskRepo, userRepo, roleRepo, evalRepo, ApprovalAuditSubscriber, EventDispatcher) is already demonstrated in `convex/request.ts` — copy that wiring.

### Pattern 4: Feed the canonical schema to Monaco's JSON language service
**What:** Register the canonical schema with Monaco's JSON defaults so it provides live validation + autocomplete. Match the editor model's URI to the schema's `fileMatch`.
**When to use:** Policy Portal editor mount (UI-01, D-58/D-59).
**Steps:**
1. Export the schema JSON from the runtime barrel (D-59) so the frontend can import it:
   ```typescript
   // src/modules/runtime/index.ts — ADD (resolveJsonModule is already true in tsconfig)
   export { default as policyContentSchema } from "./schema/policy-content.schema.json" with { type: "json" };
   ```
   *(If JSON import-attribute friction arises in the Vite/ESM build, the fallback is for the frontend to import the JSON file directly by relative path — but D-59 prefers the barrel as the public API. Confirm import style at plan time.)*
2. Configure Monaco before the model mounts, via `beforeMount`:
   ```typescript
   // web/src/features/policy/monaco-setup.ts — Source: monaco JSON diagnostics pattern (WebSearch, verified against monaco-editor DiagnosticsOptions API)
   import type { Monaco } from "@monaco-editor/react";
   import { policyContentSchema } from "@/...runtime barrel...";

   const MODEL_URI = "inmemory://policy/draft.json";
   export function configureMonacoJson(monaco: Monaco) {
     monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
       validate: true,
       enableSchemaRequest: false, // never fetch over network; use the bundled schema
       schemas: [{
         uri: "https://mini-stry.local/schema/policy-content.json", // matches schema $id
         fileMatch: [MODEL_URI],   // must equal the editor model's URI
         schema: policyContentSchema,
       }],
     });
   }
   ```
   ```tsx
   <Editor
     defaultLanguage="json"
     path="policy/draft.json"          // wrapper builds model URI from path → must match fileMatch
     beforeMount={configureMonacoJson} // register schema before model exists
     theme="vs-dark"                   // dark-only (D-V3)
   />
   ```
**Critical:** `fileMatch` must match the model URI exactly, or validation silently does nothing (the #1 Monaco-schema pitfall). [CITED: monaco-editor DiagnosticsOptions — schemas: {uri, fileMatch, schema}]

### Pattern 5: Reactive list queries that scale — never unbounded `.collect()`
**What:** Use `.order("desc").take(n)` or `.paginate()` on indexed queries instead of `.collect()` (which throws past 1024 docs and grows unbounded). All four operational views are reactive automatically via `useQuery`. [CITED: docs.convex.dev/database/pagination, stack.convex.dev/queries-that-scale]
**When to use:** Every new list adapter method (policies, versions, inbox, requests, audit).
**Note:** For the demo dataset sizes this is small, but the adapter should still bound results (`take(100)` + `order("desc")` on the existing `by_tenant_created` indexes) to follow Convex best practice and keep the demo correct as data accumulates.

### Pattern 6: Idempotent demo seed (D-62)
**What:** An `internalMutation` (not public) that checks for existing data and returns early if seeded, else inserts the full graph. Run via `npx convex run seed:seedDemoData` or `convex dev --run seed:seedDemoData`. [CITED: stack.convex.dev/seeding-data-for-preview-deployments]
**When to use:** Bootstrap; safe to rerun.
**Example skeleton:**
```typescript
// convex/seed.ts — Source: Convex init.ts idempotent pattern (verified via Convex docs)
import { internalMutation } from "./_generated/server.js";
export const seedDemoData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("tenants").first();
    if (existing) return { seeded: false }; // idempotent guard
    // insert tenants → roles → users (managerId hierarchy) → policies → versions
    //   → requestEvaluations → approvalChains → approvalTasks → auditLogs
    return { seeded: true };
  },
});
```
**Idempotency choices (Claude's discretion at plan time):** simplest is the "any data exists → skip" guard. A more robust option re-checks each entity by a natural key before insert (lets partial re-seeds heal). For a fixed demo dataset the global guard is sufficient and matches D-62 "safe to rerun."

### Anti-Patterns to Avoid
- **Putting list/query logic in `convex/` handlers.** Index selection + tenant scoping belong in the Convex *adapter* (`src/modules/*/adapters/convex/`). The handler must stay thin (HARD RULE, D-61).
- **Re-running `npx convex dev` to "init Convex" for the frontend.** The deployment + `convex/` already exist; just point `VITE_CONVEX_URL` at it.
- **Defining a second schema for Monaco.** Forbidden by D-59. Import the one canonical artifact.
- **`fileMatch` not matching the model URI.** Silent no-op validation — the most common Monaco mistake.
- **Unbounded `.collect()` in list adapters.** Use `take(n)`/`order("desc")`/`paginate`.
- **Blocking draft save on Monaco errors.** D-58: draft save is always allowed; only *publish* enforces server validation.
- **Treating Monaco markers as authoritative.** Server (Ajv) is the source of truth; Monaco is advisory.
- **Hardcoding the active tenant/actor.** Must flow from the Demo Context Selector so switching tenants reloads everything (D-56).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON validation/autocomplete in editor | Custom linter/parser | Monaco JSON language service + `setDiagnosticsOptions` | Monaco's JSON service does Draft 2020-12 validation, hover docs, autocomplete from the schema for free |
| Reactive data sync (live inbox/logs) | WebSocket/polling layer | Convex `useQuery` (push-based reactive) | D-63; Convex auto-rerenders on data change. Polling would break the no-refresh contract |
| Dark theme tokens | Bespoke CSS-in-JS theme | shadcn CSS HSL variables under `.dark` | D-V1/D-V3; UI-SPEC already specifies exact HSL triples |
| Component primitives (dialog, select, table…) | Hand-built accessible widgets | shadcn copy-in (Radix) blocks | UI-SPEC registry table lists the exact blocks; Radix handles a11y/focus |
| Class merging | String concat | `cn()` = `clsx` + `tailwind-merge` | shadcn standard; resolves Tailwind conflicts |
| Toast/feedback | Custom notification stack | `sonner` | In UI-SPEC registry list |
| Server-side schema validation | New validator in handler | Existing `validateAndEvaluate` / Ajv via `PolicyService.publishDraft` | Already implemented + 100%-tested; publish path enforces it (D-58) |
| Tenant scoping of queries | Manual `.filter(t => t.tenantId===...)` in handler | Tenant-prefixed indexes already in `convex/schema.ts` (`by_tenant_*`) used inside adapters | Indexes exist; adapters use `withIndex`; keeps handler thin |
| Approval state transitions | Re-implement approve/reject | `ApprovalRoutingService.act(ctx, taskId, action)` (exists) | Enforces approver identity, state machine, chain status, audit emit |

**Key insight:** Almost all of Phase 6's *backend behavior* already exists — Phase 6 mostly **exposes** it. The genuinely new backend code is narrow: (1) **list/read methods** missing from ports+adapters, (2) thin handlers, (3) schema barrel export, (4) the seed. Everything else is frontend assembly. Resist re-implementing domain behavior in handlers or the client.

## Runtime State Inventory

> This phase is mostly additive (new frontend + new handlers/methods), with two small modifications to existing backend symbols. Not a rename/migration, but the additive-to-existing-ports work is inventoried here for the planner.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Existing ports needing **new methods** | `PolicyRepositoryPort` (no list-by-tenant), `PolicyVersionRepositoryPort` (no list-by-policy; has `findById`/`findDraftByPolicy` only), `ApprovalTaskRepositoryPort` (no list-by-approver; has `findByChainId` only) | Add port methods + Convex adapter impls (query logic in adapter). Run `gitnexus_impact` on these classes first (CLAUDE.md). `RequestEvaluationRepositoryPort.findByTenant` and `AuditLogRepositoryPort.findByTenant` already exist — reuse |
| Existing symbol **modified** (barrel) | `src/modules/runtime/index.ts` must export `policy-content.schema.json` (D-59) | Add one export line (`with { type: "json" }`); `resolveJsonModule:true` already set. Low blast radius (additive export) |
| Empty stubs to fill | `convex/policy.ts` (`export {}`), `convex/audit.ts` (`export {}`) | Replace with thin handlers |
| New files | `convex/approval.ts`, `convex/seed.ts`, entire `web/` app | Create |
| Build artifacts / generated | `convex/_generated/api` regenerates when handlers are added (Convex dev server) | None manual; ensure Convex dev is running so the frontend's `api` types resolve |
| Stored data | Demo seed writes to existing tables; idempotent guard prevents duplicates on rerun | Seed once per fresh deployment |
| Secrets/env vars | New `web/.env.local` needs `VITE_CONVEX_URL` (the existing deployment URL). No new secrets | Document in plan; not committed |

**Nothing found:** No OS-registered state, no external live-service config (n8n/Datadog/etc.), no compiled binaries — verified by inspecting the repo (Node/TS/Convex only, no scheduler/daemon registrations).

## Common Pitfalls

### Pitfall 1: Monaco `fileMatch` doesn't match the model URI → silent no validation
**What goes wrong:** Schema registered but no markers/autocomplete appear.
**Why it happens:** `@monaco-editor/react` derives the model URI from the `path` prop; if `fileMatch` doesn't equal that URI, Monaco ignores the schema.
**How to avoid:** Set an explicit `path` on `<Editor>` and use the exact same string in `fileMatch`. Set `enableSchemaRequest:false` so it never tries to fetch.
**Warning signs:** Editor works but never flags an obviously-invalid policy.

### Pitfall 2: `@/*` alias collision between backend (`src/`) and frontend (`web/src/`)
**What goes wrong:** Imports resolve to the wrong tree or break.
**Why it happens:** Root tsconfig maps `@/*`→`src/*`; a naive shared config confuses the frontend.
**How to avoid:** Give `web/` its own `tsconfig` + `vite.config` with `@/*`→`web/src/*`, and import the Convex generated API via a distinct path/alias (e.g. relative `../convex/_generated/api` or `@convex`). Keep frontend a separate Vite root.
**Warning signs:** `Failed to resolve import` or types resolving to backend modules.

### Pitfall 3: Calling list adapters with unbounded `.collect()`
**What goes wrong:** Works in the demo, throws at 1024 docs / degrades reactivity bandwidth.
**Why it happens:** `.collect()` loads everything.
**How to avoid:** `.order("desc").take(100)` on the existing `by_tenant_created` indexes, or `.paginate()`.
**Warning signs:** Convex dashboard warns about large query reads.

### Pitfall 4: Domain logic leaking into handlers
**What goes wrong:** HARD-RULE violation; plan-checker/verifier rejects.
**Why it happens:** Temptation to filter/transform in the handler.
**How to avoid:** Handler = parse → `tenantContext(...)` → instantiate adapter/service → call → return. Put filtering/index logic in the adapter; business decisions in the service.
**Warning signs:** Any `if`/business branch, evaluation, routing, or lifecycle logic inside `convex/*.ts`.

### Pitfall 5: Approval mutations without `actorId` in `TenantContext`
**What goes wrong:** `ApprovalRoutingService.act` throws `UnauthorizedApproverError` (it checks `ctx.actorId !== task.approverId`).
**Why it happens:** Building `tenantContext(tenantId(...))` without the actor.
**How to avoid:** Approve/reject handlers must build `tenantContext(tenantId(args.tenantId), userId(args.actorId))`. Pass `actorId` from the Demo Context Selector.
**Warning signs:** Every approve attempt fails as unauthorized.

### Pitfall 6: Convex version drift between frontend and backend
**What goes wrong:** `_generated/api` types mismatch the installed `convex/react` client.
**Why it happens:** Frontend installs `convex@latest` (1.40.0) while repo pins 1.39.1.
**How to avoid:** Pin the frontend's `convex` to the same version as the backend; bump both together if at all.
**Warning signs:** Type errors importing `api`, or runtime client/codegen mismatch.

### Pitfall 7: Tailwind v4 setup mismatch
**What goes wrong:** Styles don't apply / `@tailwind` directives error.
**Why it happens:** Tailwind v4 replaced the v3 PostCSS+config flow with the `@tailwindcss/vite` plugin and `@import "tailwindcss";`.
**How to avoid:** Use `@tailwindcss/vite` in `vite.config.ts` and `@import "tailwindcss";` in the CSS entry; let `npx shadcn init` generate the rest. [CITED: ui.shadcn.com/docs/installation/vite]
**Warning signs:** Utilities have no effect; HSL variables undefined.

## Code Examples

### List-by-tenant adapter method (the missing read path) — goes in the ADAPTER, not the handler
```typescript
// src/modules/policy/adapters/convex/convex-policy-repository.ts — NEW method
// Source: mirrors existing findByRequestType withIndex pattern in this file (verified)
async listByTenant(ctx: TenantContext): Promise<Policy[]> {
  const rows = await this.db
    .query("policies")
    .withIndex("by_tenant_name", (q) => q.eq("tenantId", ctx.tenantId as Id<"tenants">))
    .collect(); // OK: per-tenant policies are bounded/small; use take() if it can grow
  return rows.map(toPolicyDomain);
}
```

### Inbox list-by-approver adapter method
```typescript
// src/modules/approval/adapters/convex/convex-approval-task-repository.ts — NEW method
// The by_tenant_approver index already exists in convex/schema.ts (verified)
async findByApprover(ctx: TenantContext, approverId: UserId): Promise<ApprovalTask[]> {
  const rows = await this.db
    .query("approvalTasks")
    .withIndex("by_tenant_approver", (q) =>
      q.eq("tenantId", ctx.tenantId as Id<"tenants">).eq("approverId", approverId as string),
    )
    .collect();
  return rows.map(toApprovalTaskDomain);
}
```

### Audit timeline handler (uses existing `findByTenant`)
```typescript
// convex/audit.ts — replace the export {} stub
import { query } from "./_generated/server.js";
import { v } from "convex/values";
import { ConvexAuditLogRepository } from "../src/modules/audit/index.js";
import { tenantContext, tenantId } from "../src/modules/directory/index.js";

export const listAuditLogs = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    const repo = new ConvexAuditLogRepository(ctx.db);
    return repo.findByTenant(tenantContext(tenantId(args.tenantId))); // exists already
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 `tailwind.config.js` + PostCSS | Tailwind v4 `@tailwindcss/vite` + `@import "tailwindcss"` | Tailwind v4 (2024–25) | shadcn Vite guide assumes v4; don't write a v3 config |
| `react-monaco-editor` | `@monaco-editor/react` (lazy-load, `beforeMount` hook) | ongoing | Use the suren-atoyan wrapper for schema-config timing |
| CRA / Webpack for React | Vite | 2023+ | Convex + shadcn both default to Vite |
| React 18 | React 19 (current) | 2024–25 | shadcn/Radix support 19; types at `@types/react@19` |
| `.collect()` everywhere | `take(n)`/`paginate()` for unbounded lists | Convex best practice | Bound all new list adapters |

**Deprecated/outdated:**
- Tailwind v3 config-file workflow — superseded by v4 Vite plugin.
- Manual `tailwindcss-animate` may be replaced by `tw-animate-css` in newer shadcn; let `shadcn init` decide rather than pre-installing.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | JSON import via `export { default as policyContentSchema } from "./schema/...json" with { type: "json" }` works cleanly through the runtime barrel into the Vite frontend build | Pattern 4 | If ESM JSON import-attributes friction arises, fall back to a direct relative JSON import on the frontend (still satisfies parity); minor plan adjustment |
| A2 | `web/` (separate Vite root + tsconfig) cleanly coexists with root `@/*`→`src/*` and the existing `convex/` | Pattern 1, Pitfall 2 | If collisions occur, use `vite-tsconfig-paths` or a distinct `@app` alias; low risk |
| A3 | Frontend should pin `convex` to the backend's version (1.39.1) rather than 1.40.0 | Stack, Pitfall 6 | Mismatch causes `api` type drift; pinning is the safe default |
| A4 | Per-tenant policy/version/task counts are small enough that `.collect()` in adapters is acceptable for the demo (with `take()` recommended) | Code Examples | Only matters at scale; demo-safe |
| A5 | `shadcn init` New York/Zinc/CSS-vars/dark-default matches UI-SPEC intent | Stack install | UI-SPEC explicitly specifies these; low risk |
| A6 | `monaco.languages.json.jsonDefaults.setDiagnosticsOptions({ schemas:[{uri,fileMatch,schema}] })` is the correct current API surface | Pattern 4 | Verified across multiple sources but not against a single official Microsoft doc page in this session; MEDIUM. Confirm signature at implementation time |
| A7 | No backend Convex version bump is required for Phase 6 (handlers use existing `query`/`mutation`/`internalMutation` builders) | Stack | `internalMutation` is already exported by `_generated/server`; verified |

## Open Questions

1. **Exact JSON-schema-into-Monaco import path (barrel vs direct).**
   - What we know: `resolveJsonModule:true`; barrel export is D-59's intent; the schema has a stable `$id`.
   - What's unclear: whether the import-attribute barrel re-export survives the Vite frontend build without friction.
   - Recommendation: try barrel export first; if the Vite build complains, import the JSON directly in the frontend (parity preserved — same file). Decide in 06-02.

2. **Frontend directory name + Convex generated-api import strategy.**
   - What we know: `web/` avoids collisions; the frontend needs `convex/_generated/api`.
   - What's unclear: relative import vs a dedicated `@convex` alias (cleaner but more config).
   - Recommendation: relative import for simplicity; add an alias only if import paths get deep.

3. **Version-diff presentation (UI-04) and execution-trace visualization (UI-02).**
   - What we know: deferred/not deep-dived (CONTEXT discretion); trace already stored on `requestEvaluations.trace`.
   - Recommendation: standard side-by-side/inline diff and a simple ordered trace list; keep minimal per D-V2.

4. **Whether to add `convex-test` handler tests or rely on the existing fake-db unit pattern.**
   - What we know: `tests/_helpers/convex-ctx-fixture.ts` already fakes the db for adapter unit tests; `convex-test` (0.0.53, pre-1.0) would test full handlers.
   - Recommendation: extend the existing fake-db pattern for new adapter methods; treat `convex-test` as optional. See Validation Architecture.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | ✓ | ≥18.18 (`engines`) | — |
| npm | Install/scaffold | ✓ | bundled | pnpm (shadcn docs use pnpm; npm works) |
| Convex CLI (`convex`) | dev server, `convex run` for seed | ✓ (dependency) | 1.39.1 pinned | — |
| Convex deployment | `VITE_CONVEX_URL`, reactive queries | ✓ (backend exists, Phases 1–5 deployed against it) | — | — |
| TypeScript | Build | ✓ | 5.9.3 | — |
| Vitest | Tests | ✓ | 4.1.7 | — |

**Missing dependencies with no fallback:** none — all required tooling is present.
**Missing dependencies with fallback:** Frontend npm packages (React/Vite/shadcn/Monaco) are not yet installed; installation is part of Plan 06-01. shadcn docs default to `pnpm dlx`; `npx` works equivalently.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.7 (`environment: node`) |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test` (`vitest run --reporter=dot`) |
| Full suite command | `npm run test:coverage` |
| Frontend test note | Existing config is node-only and includes `tests/**/*.test.ts` + `src/**/*.test.ts`. React component tests would need a jsdom environment + `web/` glob — out of the existing harness. Recommend keeping Phase 6 automated tests at the **backend** layer (adapters/handlers) and treating UI behavior as manual/demo verification, OR adding a separate `web/vitest.config.ts` with jsdom + Testing Library if component tests are wanted (scope decision for the planner). |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | New `PolicyVersionRepositoryPort` list-versions method returns tenant-scoped, policy-scoped versions | unit (fake-db) | `npx vitest run tests/modules/policy/convex-policy-version-repository.test.ts` | ❌ Wave 0 (extend existing policy adapter tests) |
| UI-01 | `PolicyRepositoryPort.listByTenant` is tenant-isolated (tenant A never sees tenant B) | unit (fake-db) | `npx vitest run tests/modules/policy/` | ❌ Wave 0 |
| UI-01 | Monaco↔runtime schema parity: a doc Ajv accepts, the imported schema must validate; a doc Ajv rejects, the schema must reject | unit (parity) | `npx vitest run tests/modules/runtime/schema-parity.test.ts` | ❌ Wave 0 — assert the barrel-exported schema is the *same object* Ajv loads; reuse existing valid/invalid fixtures (`schema-valid.test.ts`, `schema-invalid.test.ts`) |
| UI-02 | List-requests-by-tenant returns only the tenant's evaluations | unit (fake-db) | `npx vitest run tests/modules/request/` | ❌ Wave 0 (uses existing `findByTenant`) |
| UI-03 | `findByApprover` returns only tasks where `approverId === actorId`, tenant-scoped | unit (fake-db) | `npx vitest run tests/modules/approval/` | ❌ Wave 0 |
| UI-03 | Approve/Reject path: `act` rejects when `actorId !== approverId` | unit | `npx vitest run tests/modules/approval/` | ✅ likely covered by existing approval tests; verify unauthorized-approver case |
| UI-04 | Audit list-by-tenant returns tenant-scoped logs in order | unit | `npx vitest run tests/modules/audit/` | ❌ Wave 0 (uses existing `findByTenant`) |
| D-62 | Seed is idempotent: second run inserts nothing | integration (convex-test) OR manual | `npx convex run seed:seedDemoData` twice; assert no duplicate tenants | ❌ Wave 0 (manual acceptable; convex-test optional) |
| D-61 | Handlers contain no domain logic | static/review + lint (`import/no-restricted-paths`) | `npm run lint` | ✅ ESLint zones enforce import boundaries; review enforces no-branching |

### Sampling Rate
- **Per task commit:** `npm test` (fast, dot reporter).
- **Per wave merge:** `npm run test:coverage` (90% global / 100% runtime+approval thresholds enforced by `vitest.config.ts`). Note: new Convex adapter list methods are **excluded from coverage** by config, so their unit tests are quality-driven, not threshold-gated — still write them.
- **Phase gate:** Full suite green + `npm run lint` + `npm run typecheck` clean, plus a manual demo run of the live cross-user flow (D-63) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/modules/runtime/schema-parity.test.ts` — asserts the barrel-exported `policyContentSchema` is the canonical artifact Ajv uses (D-59 parity invariant). **Highest-value new test.**
- [ ] Extend `tests/modules/policy/` — list-by-tenant + list-versions-by-policy tenant isolation.
- [ ] Extend `tests/modules/approval/` — `findByApprover` scoping + unauthorized-approver act case.
- [ ] (Optional) `web/vitest.config.ts` + Testing Library if React component tests are in scope — otherwise UI is demo/manual-verified.
- [ ] Framework install: none for backend (Vitest present). `convex-test@0.0.53` only if handler integration tests are chosen.

*Existing infra covers domain/runtime/approval behavior at 100%; the gaps above are the new read paths + the parity invariant.*

## Security Domain

> `security_enforcement` ON (ASVS L1). No auth this phase (D-55) — so V2/V3 are explicitly N/A; the live security surface is **tenant isolation at the handler boundary** and **input validation**.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (D-55 defers auth) | N/A — Demo Context Selector simulates identity; document as a known demo limitation |
| V3 Session Management | no (D-55) | N/A |
| V4 Access Control | **yes** | Tenant isolation: every handler builds `TenantContext` and every adapter query uses a `by_tenant_*` index (no cross-tenant reads). Actor-scoping: Inbox/My-Requests filter by `actorId`; `act()` enforces `actorId === approverId` (`UnauthorizedApproverError`). **Caveat:** with no auth, `tenantId`/`actorId` are client-supplied — isolation is *enforced* (queries are scoped) but *not authenticated*; this is acceptable per D-55 and must be flagged in the threat_model as a deferred control |
| V5 Input Validation | **yes** | Handler args validated with Convex `v.*` validators; policy JSON validated by Ajv server-side on publish (authoritative, D-58); `EvaluationContext` JSON `JSON.parse`d (never `eval`) |
| V6 Cryptography | no | No secrets/crypto introduced; `VITE_CONVEX_URL` is a public deployment URL, not a secret |

### Known Threat Patterns for {React SPA + thin Convex handlers, no auth}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant data read (client passes another tenant's `tenantId`) | Information Disclosure / Elevation | **Inherent to D-55** — no auth means any `tenantId` is accepted. Mitigation now: queries are strictly tenant-scoped via indexes (no data leaks *across* a scoped query); full mitigation (verifying the caller owns the tenant) is deferred with auth. Flag in threat_model |
| Spoofed approver acts on another's task | Spoofing / Elevation | `act()` checks `ctx.actorId === task.approverId` and throws `UnauthorizedApproverError` (already implemented) — keep this enforced in the approve/reject handlers by passing real `actorId` |
| Malicious/invalid policy JSON bypassing validation | Tampering | Server Ajv validation on publish is authoritative (D-58); Monaco advisory only. Draft save tolerant by design |
| Code execution via policy/context content | Tampering / Elevation | No `eval()` anywhere; JSON is parsed and structurally evaluated (RUN-02 constraint upheld) |
| Secret leakage to client bundle | Information Disclosure | Only `VITE_CONVEX_URL` (public) is exposed; never embed deploy keys or admin keys in `web/` |
| XSS via rendered policy/trace content | Tampering | React escapes by default; render JSON/trace as text (Monaco/`<pre>`), never `dangerouslySetInnerHTML` |
| Unbounded query DoS / bandwidth | DoS | Bound list adapters (`take`/`paginate`); reactive subscriptions on bounded result sets |

**threat_model note for the planner:** Each plan touching handlers should include a `threat_model` block asserting (1) tenant-scoped indexes on every read, (2) `actorId` passed for approval mutations, (3) Ajv authoritative on publish, (4) the explicit deferred-auth limitation (client-supplied identity) acknowledged per D-55.

## Sources

### Primary (HIGH confidence)
- Repo source (read directly): `convex/{directory,request,schema,policy,audit}.ts`, `convex/_branded.ts`, `eslint.config.js`, `vitest.config.ts`, `tsconfig.json`, `package.json`, `src/modules/{runtime,policy,approval,audit,request,directory}/index.ts` + ports + Convex adapters + service signatures — verified the existing thin-handler template, the Convex HARD RULE enforcement, the missing list methods, the existing `findByTenant`/`findByApprover`-index, and `ApprovalRoutingService.act` signature.
- `npm view <pkg> version` for all recommended packages (2026-06-04) — version + postinstall verification.
- docs.convex.dev/quickstart/react — ConvexProvider/ConvexReactClient/`VITE_CONVEX_URL`/`useQuery` setup.
- ui.shadcn.com/docs/installation/vite — shadcn init, Tailwind v4 `@tailwindcss/vite`, `@` alias config.
- docs.convex.dev/database/pagination + stack.convex.dev/queries-that-scale — `.collect()` limits, `take`/`paginate`, reactive pagination.
- stack.convex.dev/seeding-data-for-preview-deployments — idempotent `internalMutation` seed pattern, `convex run`.

### Secondary (MEDIUM confidence)
- monaco-editor `DiagnosticsOptions` API (`schemas: [{uri, fileMatch, schema}]`, `validate`, `enableSchemaRequest`) — corroborated across multiple sources (StackOverflow/Medium/typedoc); not cross-checked against a single official Microsoft page in this session.
- lucide-react 1.17.0 as current `latest` — confirmed via `npm view ... dist-tags`.

### Tertiary (LOW confidence)
- Exact Tailwind-v4 vs `tailwindcss-animate`/`tw-animate-css` choice — let `shadcn init` resolve; not pinned here.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified on npm; Convex+Vite+shadcn are documented, mutually-recommended integrations.
- Backend wiring: HIGH — read the actual templates, ports, adapters, service signatures, and ESLint zones; the missing-list-method gap is verified, not assumed.
- Monaco schema feed: MEDIUM — pattern corroborated across sources; exact API call should be confirmed at implementation.
- Frontend layout coexistence: MEDIUM — sound approach (separate Vite root) but the `@/*` collision avoidance should be validated during 06-01.
- Pitfalls / security: HIGH — derived from verified code constraints (HARD RULE, `act` identity check, tenant indexes) and Convex best-practice docs.

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (30 days; React/Vite/Tailwind move moderately — re-verify versions if planning slips past this).
