# Mini-stry — Architecture

## Module Boundary Rule (D-08)
"Cross-module imports are ALLOWED. Cross-module coupling is NOT."

Mini-stry uses a system goblin version of Modular Monolith framing.
- Allowed: `runtime → @/modules/policy` (through `index.ts`)
- Forbidden: `runtime → @/modules/policy/application/*` (deep import — "chui cửa sổ")
- Enforced by: ESLint `import/no-restricted-paths` + mandatory per-module barrel `index.ts` + mandatory per-module `README.md`

## Hexagonal Layers
- **domain**: state only, no I/O.
- **application**: services + TenantContext-first methods + port interfaces.
- **adapters/convex**: Convex Id <-> branded ID mappers, ctx.db queries.
- **adapters/memory**: in-memory fakes for tests.

## convex/ HARD RULE
- convex/ **MAY**: validate input shape · instantiate dependencies · call application services · map responses
- convex/ **MAY NOT**: evaluate policies · enforce business rules · perform approval routing · contain domain logic

## TenantContext (D-19)
First-class operational envelope, every service method takes ctx: TenantContext as first param, no AsyncLocalStorage/globals, parallel concept to EvaluationContext (Phase 2).

## Branded String IDs (D-14)
Domain types use `string & { __brand: 'X' }`, mappers at adapter boundary translate Convex Id<'table'> <-> branded; zero runtime cost.

## Architectural Responsibility Map
| Module | Responsibility | Core Entities | Interfaces |
|---|---|---|---|
| directory | Org chart, Roles, Users | User, Role | UserService, RoleService |
| policy | Content & rules engine | Policy, Version | PolicyEvaluator |
| audit | Immutable event log | AuditLog | AuditService |
