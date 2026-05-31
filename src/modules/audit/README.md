# Module: audit

## Status: skeleton at Phase 1
Entity + ID + storage only; logging behavior wires in Phase 3+ when policy lifecycle events emit.

## Public API
- **Entities**: AuditLog
- **Branded IDs**: AuditLogId (and factory)

## Open eventType convention (D-16)
The eventType is intentionally an open string; per-module constants live in originating modules (e.g., directory might export `RoleEvents.CREATED = "role.created"`); audit never centralizes a registry.

## Module Boundary Rule
"Cross-module imports are ALLOWED. Cross-module coupling is NOT."

Forbidden pattern (deep import):
`import { ... } from "@/modules/audit/domain/audit-log"`

Allowed pattern (barrel import):
`import { ... } from "@/modules/audit"`
