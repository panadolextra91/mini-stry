# Convex Layer — Adapter and Persistence

## Status
Phase 1 produces schema + skeleton handler files; plan 01-04 wires directory module DI into convex/directory.ts.

## convex/ HARD RULE (from ARCHITECTURE.md and CONTEXT.md):
- **Allowed**: validate input shape (via Convex args validator), resolve TenantContext from auth/args, instantiate application service dependencies, call services, map domain responses to wire shapes.
- **Forbidden**: evaluate policies (Phase 2 runtime), enforce business rules (application layer owns), perform approval routing (Phase 5 reference consumer), contain domain logic of any kind.

## Tenant Isolation (D-09)
Every query on a tenant-owned table MUST use `.withIndex("by_tenant_*", q => q.eq("tenantId", ctx.tenantId))`. A `.collect()` without that prefix is a tenant-isolation review smell. The composite indexes make tenant filtering the cheapest path.

## Schema fields reserved for Convex Auth (Pitfall 4)
users table includes email (required), image, emailVerificationTime, isAnonymous, phone (optional), plus the by_email index. Phase 2+ Convex Auth wiring will write into these fields without a migration.

## PolicyVersion.content
Intentionally `v.any()` per D-12. Phase 2 JSON Schema validator owns the shape.

## AuditLog.eventType
Open string per D-16; convention `<aggregate>.<action>`.
