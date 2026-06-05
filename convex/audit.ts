/**
 * convex/ HARD RULE:
 * Allowed: validate input shape, instantiate dependencies, call application services, map responses.
 * Forbidden: evaluate policies, enforce business rules, perform approval routing, contain domain logic.
 */
import { query } from "./_generated/server.js";
import { v } from "convex/values";
import { ConvexAuditLogRepository } from "../src/modules/audit/index.js";
import { tenantContext, tenantId } from "../src/modules/directory/index.js";

export const listAuditLogs = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    const repo = new ConvexAuditLogRepository(ctx.db);
    return repo.findByTenant(tenantContext(tenantId(args.tenantId)));
  },
});
