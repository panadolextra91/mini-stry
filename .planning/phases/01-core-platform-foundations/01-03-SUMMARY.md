---
phase: 01-core-platform-foundations
plan: 03
subsystem: foundations
tags:
  - convex
  - schema
  - multi-tenant
  - indexes
  - tenant-isolation
requires: [01-02]
provides:
  - convex-schema
  - convex-generated
affects: []
key-files.created:
  - convex/schema.ts
  - convex/_branded.ts
  - convex/directory.ts
  - convex/policy.ts
  - convex/audit.ts
  - convex/README.md
key-decisions:
  - Every tenant-owned table prefixes its indexes with tenantId (D-09).
  - Users table reserves Convex Auth fields (email required, image, emailVerificationTime, isAnonymous, phone optional).
  - policyVersions.content is `v.any()` (D-12).
  - auditLogs.eventType is `v.string()` (D-16).
requirements-completed: [CON-01, CON-02, CON-03, CON-04, POL-05, POL-06, AUD-03]
---

# Phase 01 Plan 03: Convex Schema Summary

Defined the complete Phase 1 Convex persistence schema implementing D-09 logical multi-tenant isolation via tenantId-first composite indexes.

**Tasks completed**: 2/2
**Files created**: 6 (plus generated code)

## Tables Defined (6 total)

1. `tenants`
2. `users`
3. `roles`
4. `policies`
5. `policyVersions`
6. `auditLogs`

## Indexes Added

- `users`:
  - `by_tenant_email`: `["tenantId", "email"]`
  - `by_tenant_role`: `["tenantId", "roleId"]`
  - `by_tenant_manager`: `["tenantId", "managerId"]`
  - `by_email`: `["email"]` (Convex Auth requirement)
- `roles`:
  - `by_tenant_name`: `["tenantId", "name"]`
- `policies`:
  - `by_tenant_name`: `["tenantId", "name"]`
- `policyVersions`:
  - `by_tenant_policy_version`: `["tenantId", "policyId", "versionNumber"]`
  - `by_tenant_policy_published`: `["tenantId", "policyId", "publishedAt"]`
- `auditLogs`:
  - `by_tenant_created`: `["tenantId", "createdAt"]`

## Convex Auth Fields Reserved (on `users`)

- `email: v.string()`
- `image: v.optional(v.string())`
- `emailVerificationTime: v.optional(v.number())`
- `isAnonymous: v.optional(v.boolean())`
- `phone: v.optional(v.string())`

## Shape Confirmations

- `policyVersions.content` is confirmed as `v.any()`
- `auditLogs.eventType` is confirmed as `v.string()` (open string)

## Codegen Output

`npx convex dev --once` run in anonymous agent mode successfully bootstrapped the backend, provisioned the schema, and produced both `convex/_generated/dataModel.d.ts` and `convex/_generated/server.d.ts`.

## Deviations from Pattern 1

None. The schema implements Pattern 1 verbatim and aligns completely with Phase 1 requirements.

## Self-Check: PASSED

Ready for 01-04-PLAN.md.
