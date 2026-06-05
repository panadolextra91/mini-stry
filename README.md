# Mini-stry — Policy Runtime Platform

> A domain-neutral engine that turns **structured JSON policies** into **deterministic decisions**, with an immutable lifecycle, a reference approval-routing consumer, a governance ledger, and a premium Monaco-based admin portal.

Mini-stry is built around a single, deliberately small idea:

```
Policy + EvaluationContext  →  Decision
```

A **Policy** is a versioned set of JSON rules. An **EvaluationContext** is an arbitrary domain payload (`{ amount: 500, department: "IT" }`, `{ leave_days: 3 }`, …). The runtime validates the policy against a JSON Schema, evaluates its rules against the context in pure TypeScript (no `eval`), and emits a **Decision** — `auto-approve`, `auto-reject`, or `request-approval`. Everything else in the platform is built *around* that pure function without leaking into it.

---

## What it does (MVP / current version)

| Capability | Summary |
|------------|---------|
| **Multi-tenant directory** | Tenants, dynamic per-tenant Roles, Users linked by stable `roleId`, and supervisor reporting lines (`managerId`). |
| **Policy runtime** | Pure-TS rule evaluator + native JSON Schema validation (Ajv, draft 2020-12). Deterministic, side-effect-free, `eval`-free. |
| **Policy lifecycle** | Draft → Publish → Rollback with immutable published versions, optimistic concurrency, and an active-version pointer. |
| **Request runtime** | Submit an `EvaluationContext` against the active policy for a request type; persist the decision and a step-by-step evaluation trace. |
| **Approval routing** | A *reference* Decision Consumer: converts `request-approval` decisions into a supervisor-approval task by walking the `managerId` chain. |
| **Governance ledger** | Immutable, append-only audit log of every lifecycle event, evaluation, and approval action. |
| **Admin portal** | React 19 + Convex reactive UI: Monaco JSON editor (schema autocomplete), Request Center, Personal Inbox, Governance Viewer — all live/reactive. |

The runtime is **domain-neutral**: there is no HR, finance, or any vertical-specific code in the core. The included "expense" and "leave" examples are demonstrations, not built-in features.

---

## Key decisions & trade-offs

These are the choices that shape the codebase. The full rationale and the complete decision log live in [ARCHITECTURE.md](ARCHITECTURE.md).

| Decision | Why | Trade-off accepted |
|----------|-----|--------------------|
| **Structured JSON policies, not a custom DSL** | A lexer/parser/AST compiler is overengineering for the MVP and a large surface for bugs. JSON + JSON Schema gives validation, autocomplete, and immutability for free. | No custom grammar/expressions; rule shape is fixed to `compare` predicates in v1. |
| **Decision Consumers are external to the runtime** | Approval routing is *one* consumer among many possible (notifications, escalations, webhooks). The runtime emits Decisions and never imports a consumer. | An extra integration seam (in-process events) between "decide" and "act". |
| **Modular Monolith + Hexagonal (Ports & Adapters)** | Keeps the domain pure and swappable (Convex today, anything tomorrow) while avoiding the operational cost of microservices. | Discipline overhead: per-module barrels, port interfaces, two adapter sets (Convex + in-memory). |
| **`TenantContext` passed explicitly as the first arg everywhere** | Tenant is a security boundary. Making it explicit at every call site makes data-leak risk visible at code-review time. No `AsyncLocalStorage`, no globals. | Slightly more verbose signatures. |
| **JSON Schema validation lives in the runtime core (not lifecycle)** | The evaluator must never run on an unvalidated policy. Validation is a *prerequisite* to evaluation, so it belongs next to it; the lifecycle reuses the same validator at its boundaries. | One validator artifact is load-bearing across runtime, lifecycle, and the Monaco editor. |
| **Synchronous in-process event bus** | Lifecycle/evaluation/approval emit typed events that audit + routing subscribe to — decoupled, but no Kafka/queue to operate. | Not durable across process restarts; suitable for the MVP, not high-scale async fan-out. |
| **Demo context instead of real auth** | The MVP showcases the runtime, not an IAM. A `{ tenantId, actorId }` selector simulates users. (Convex Auth fields are *reserved* in the schema for later.) | No real authentication/authorization yet. |
| **Convex-compatible Ajv** | The Convex V8 runtime forbids code-generation-from-strings, so Ajv's default runtime compile throws. The schema is **precompiled** to standalone ESM ahead of time. | A build step (`compile-schema.js`) must regenerate the validator when the schema changes. |

---

## Architecture at a glance

```
                    ┌──────────────────────────────────────────────┐
   Admin Portal     │  web/  — React 19 + Vite + Convex React       │
   (4 reactive      │  Monaco · shadcn/ui (dark) · DemoContext      │
    views)          └───────────────────────┬──────────────────────┘
                                             │ reactive queries / mutations
                    ┌────────────────────────▼──────────────────────┐
   Thin DI layer    │  convex/  — handlers (validate · wire · map)   │
   (NO domain logic)│  policy · request · approval · audit · seed    │
                    └────────────────────────┬──────────────────────┘
                                             │ calls application services
   ┌─────────────────────────────────────────▼─────────────────────────────────────────┐
   │  src/modules/  — Modular Monolith, Hexagonal (domain · application · adapters)       │
   │                                                                                     │
   │   directory ──┐                                                                     │
   │   runtime ────┼─▶ policy ──▶ request ──(RequestEvaluated event)──▶ approval         │
   │               │      │           │                                    │             │
   │               └──────┴───────────┴────────────(domain events)────────▶ audit        │
   └─────────────────────────────────────────────────────────────────────────────────────┘
```

The **runtime never imports a consumer**. `request` emits a `RequestEvaluated` event; `approval` (a reference consumer) and `audit` subscribe. See [ARCHITECTURE.md](ARCHITECTURE.md) for layer diagrams, the evaluation algorithm, the approval-routing walk, the data model, and sequence diagrams.

---

## Project structure

```
mini-stry/
├── src/modules/            # Domain core — pure TS, framework-agnostic
│   ├── directory/          #   Tenants, Roles, Users, managerId, TenantContext
│   ├── runtime/            #   Evaluator + Ajv validator + Decision + canonical JSON Schema
│   ├── policy/             #   Policy + PolicyVersion lifecycle (draft/publish/rollback)
│   ├── request/            #   PolicyRuntimeService.submit — resolve → evaluate → persist
│   ├── approval/           #   Reference Decision Consumer (manager-walk routing + state machine)
│   └── audit/              #   By-reference immutable governance ledger
├── src/shared/             # EventDispatcher (typed in-process bus)
├── convex/                 # Thin handlers + schema.ts (8 tables) + seed.ts
├── web/                    # React 19 admin portal (Vite + Convex + Monaco + shadcn/ui)
├── compile-schema.js       # Precompiles JSON Schema → standalone Ajv ESM for Convex
├── ARCHITECTURE.md         # Full technical documentation
└── .planning/              # Phase plans, decisions, research (GSD workflow artifacts)
```

Each `src/modules/<m>/` follows the same shape: `domain/` (state only), `application/` (services + `ports/`), `adapters/convex/` + `adapters/memory/`, and a public barrel `index.ts`. **Cross-module imports go through the barrel only** — deep imports are blocked by ESLint.

---

## Tech stack

- **Core:** TypeScript 5.9.3 (strict), pure-TS domain, ESM
- **Validation:** Ajv 8.17 (JSON Schema draft 2020-12), precompiled for the Convex runtime
- **Backend / persistence:** Convex 1.39 (reactive document DB + functions)
- **Frontend:** React 19, Vite, `react-router-dom`, Convex React client, `@monaco-editor/react`, shadcn/ui (dark-only), Tailwind, sonner
- **Testing:** Vitest — 227 tests across 34 files; 100% coverage on the runtime

---

## Quick start

### 1. Backend / domain (no services required)

```bash
npm install
npm test           # 227 tests
npm run typecheck
npm run lint
```

The domain layer and its in-memory adapters run entirely in-process — no database needed for the test suite.

### 2. Run the full app (portal + live backend)

Requires two processes. The web client reads `VITE_CONVEX_URL` from `web/.env.local`.

```bash
# Terminal A — Convex backend (local dev deployment). Keeps running + watches files.
npx convex dev

# Seed demo data (2 tenants, roles, users w/ manager hierarchy, a published policy)
npx convex run seed:seedDemoData

# Terminal B — admin portal
cd web
npm install
npm run dev        # http://localhost:5173
```

> If you change `src/modules/runtime/schema/policy-content.schema.json`, regenerate the
> Convex-compatible validator: `node compile-schema.js`.

### 3. Walk the demo (cross-user reactive flow)

1. In the portal, pick **Active Tenant = Acme Corp** and **Active User = Acme Requester**.
2. **Request Center** → submit an EvaluationContext like `{ "amount": 500 }` against `expense`. The policy rule (`amount > 0`) yields a `request-approval` decision.
3. Switch **Active User = Acme Manager** → **Personal Inbox** shows the routed task (the requester's manager holds the target role).
4. **Approve** it. The decision propagates live, and **Governance** records `approval.task_approved`.

Everything updates reactively via Convex subscriptions — no manual refresh.

---

## Build & verify

```bash
# Backend
npm test && npm run typecheck && npm run lint

# Web
cd web && npm run lint && npm run build && npm test
```

---

## Status & roadmap

**MVP complete** — Phases 1–6 shipped: directory foundations, runtime core, policy lifecycle, request runtime, reference approval consumer, and the admin portal. 20/25 v1 requirements validated through Phase 4 artifacts; lifecycle, routing, and UI delivered in Phases 3/5/6.

**Planned (v2):** logical operators (`AND`/`OR`/`NOT`) in rules, parallel/N-of-M approval groups, SLA deadlines & auto-escalation, additional Decision Consumers (notifications, webhooks), and Slack/Teams/Calendar integrations.

**Known MVP limitations:** demo context instead of real auth; single-stage manager-walk routing (no multi-stage chains yet); `getNextVersionNumber` uses query-max-plus-1 (not atomic — fine for the MVP, must be transactional in production); the Monaco bundle is large (~500 KB). These and others are catalogued in [ARCHITECTURE.md → Known limitations](ARCHITECTURE.md#known-limitations--non-goals).

---

## Further reading

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — full technical documentation: layer model, module contracts, evaluation algorithm, lifecycle & routing state machines, data model, event/audit system, the Convex-Ajv trade-off, frontend architecture, the decision log, and the testing strategy.
- **`.planning/`** — phase-by-phase plans, research, and the design decisions (`D-xx`) referenced throughout the code.
