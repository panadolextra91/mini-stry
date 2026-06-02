import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex Schema for Mini-stry
 *
 * Decisions Enforced:
 * - D-09: Every tenant-owned table prefixes its indexes with tenantId.
 * - D-10: Roles have [tenantId, name] unique composite logic in the application layer.
 * - D-11: managerId is a nullable self-reference on users.
 * - D-12: policyVersions.content is intentionally v.any() at Phase 1.
 * - D-16: auditLogs.eventType is an open string.
 * - RESEARCH.md Pitfall 4: users table reserves Convex Auth fields.
 * - RESEARCH.md Pitfall 5: managerId uses v.union(v.id("users"), v.null()) not v.optional.
 */
export default defineSchema({
  tenants: defineTable({
    name: v.string(),
    createdAt: v.number(),
  }),

  users: defineTable({
    tenantId: v.id("tenants"),
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    phone: v.optional(v.string()),
    roleId: v.id("roles"),
    managerId: v.union(v.id("users"), v.null()),
    createdAt: v.number(),
  })
    .index("by_tenant_email", ["tenantId", "email"])
    .index("by_tenant_role", ["tenantId", "roleId"])
    .index("by_tenant_manager", ["tenantId", "managerId"])
    .index("by_email", ["email"]), // Convex Auth requirement

  roles: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_tenant_name", ["tenantId", "name"]),

  policies: defineTable({
    tenantId: v.id("tenants"),
    name: v.string(),
    activeVersionId: v.union(v.id("policyVersions"), v.null()),
    createdAt: v.number(),
  }).index("by_tenant_name", ["tenantId", "name"]),

  policyVersions: defineTable({
    tenantId: v.id("tenants"),
    policyId: v.id("policies"),
    versionNumber: v.number(),
    content: v.any(), // Intentionally v.any() per D-12; Phase 2 owns the shape
    status: v.string(), // 'draft' | 'published' (D-32)
    validationStatus: v.string(), // 'valid' | 'invalid' | 'unchecked' (D-34)
    validationErrors: v.array(v.object({ code: v.string(), path: v.string(), message: v.string() })),
    revision: v.number(), // optimistic concurrency counter (D-36)
    rollbackFromVersionId: v.union(v.id("policyVersions"), v.null()), // D-33 forward clone metadata
    createdBy: v.string(), // UserId (branded string stored as plain string in Convex)
    publishedAt: v.union(v.number(), v.null()),
  })
    .index("by_tenant_policy_version", ["tenantId", "policyId", "versionNumber"])
    .index("by_tenant_policy_published", ["tenantId", "policyId", "publishedAt"])
    .index("by_tenant_policy_status", ["tenantId", "policyId", "status"]),


  auditLogs: defineTable({
    tenantId: v.id("tenants"),
    eventType: v.string(), // OPEN per D-16
    payload: v.any(),
    createdAt: v.number(),
  }).index("by_tenant_created", ["tenantId", "createdAt"]),
});
