/**
 * convex/ HARD RULE:
 * Allowed: validate input shape, instantiate dependencies, call application services, map responses.
 * Forbidden: evaluate policies, enforce business rules, perform approval routing, contain domain logic.
 */
import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import { EventDispatcher } from "../src/shared/event-dispatcher.js";
import { PolicyService } from "../src/modules/policy/index.js";
import type { PolicyEventMap } from "../src/modules/policy/index.js";
import { ConvexPolicyRepository } from "../src/modules/policy/adapters/convex/convex-policy-repository.js";
import { ConvexPolicyVersionRepository } from "../src/modules/policy/adapters/convex/convex-policy-version-repository.js";
import { AjvSchemaValidator } from "../src/modules/runtime/index.js";
import { ConvexAuditLogRepository, AuditEventSubscriber } from "../src/modules/audit/index.js";
import { tenantContext, tenantId, userId } from "../src/modules/directory/index.js";
import { policyId, policyVersionId } from "../src/modules/policy/index.js";

export const listPolicies = query({
  args: { tenantId: v.string() },
  handler: async (ctx, args) => {
    const repo = new ConvexPolicyRepository(ctx.db);
    return repo.listByTenant(tenantContext(tenantId(args.tenantId)));
  },
});

export const listVersions = query({
  args: { tenantId: v.string(), policyId: v.string() },
  handler: async (ctx, args) => {
    const repo = new ConvexPolicyVersionRepository(ctx.db);
    return repo.listByPolicy(tenantContext(tenantId(args.tenantId)), policyId(args.policyId));
  },
});

export const createPolicy = mutation({
  args: {
    tenantId: v.string(),
    name: v.string(),
    requestType: v.string(),
  },
  handler: async (ctx, args) => {
    const policyDispatcher = new EventDispatcher<PolicyEventMap>();
    const auditRepo = new ConvexAuditLogRepository(ctx.db);
    void new AuditEventSubscriber(auditRepo, policyDispatcher);

    const policyRepo = new ConvexPolicyRepository(ctx.db);
    const versionRepo = new ConvexPolicyVersionRepository(ctx.db);
    const policyValidator = new AjvSchemaValidator();
    const policyService = new PolicyService(
      policyRepo,
      versionRepo,
      policyValidator,
      policyDispatcher,
    );

    const tCtx = tenantContext(tenantId(args.tenantId));
    return policyService.createPolicy(tCtx, { name: args.name, requestType: args.requestType });
  },
});

export const createDraft = mutation({
  args: {
    tenantId: v.string(),
    policyId: v.string(),
    content: v.any(),
    actorId: v.string(),
  },
  handler: async (ctx, args) => {
    const policyDispatcher = new EventDispatcher<PolicyEventMap>();
    const auditRepo = new ConvexAuditLogRepository(ctx.db);
    void new AuditEventSubscriber(auditRepo, policyDispatcher);

    const policyRepo = new ConvexPolicyRepository(ctx.db);
    const versionRepo = new ConvexPolicyVersionRepository(ctx.db);
    const policyValidator = new AjvSchemaValidator();
    const policyService = new PolicyService(
      policyRepo,
      versionRepo,
      policyValidator,
      policyDispatcher,
    );

    const tCtx = tenantContext(tenantId(args.tenantId), userId(args.actorId));
    return policyService.createDraft(tCtx, policyId(args.policyId), args.content, userId(args.actorId));
  },
});

export const saveDraft = mutation({
  args: {
    tenantId: v.string(),
    versionId: v.string(),
    content: v.any(),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const policyDispatcher = new EventDispatcher<PolicyEventMap>();
    const auditRepo = new ConvexAuditLogRepository(ctx.db);
    void new AuditEventSubscriber(auditRepo, policyDispatcher);

    const policyRepo = new ConvexPolicyRepository(ctx.db);
    const versionRepo = new ConvexPolicyVersionRepository(ctx.db);
    const policyValidator = new AjvSchemaValidator();
    const policyService = new PolicyService(
      policyRepo,
      versionRepo,
      policyValidator,
      policyDispatcher,
    );

    const tCtx = tenantContext(tenantId(args.tenantId));
    return policyService.saveDraft(tCtx, policyVersionId(args.versionId), args.content, args.expectedRevision);
  },
});

export const publish = mutation({
  args: {
    tenantId: v.string(),
    versionId: v.string(),
  },
  handler: async (ctx, args) => {
    const policyDispatcher = new EventDispatcher<PolicyEventMap>();
    const auditRepo = new ConvexAuditLogRepository(ctx.db);
    void new AuditEventSubscriber(auditRepo, policyDispatcher);

    const policyRepo = new ConvexPolicyRepository(ctx.db);
    const versionRepo = new ConvexPolicyVersionRepository(ctx.db);
    const policyValidator = new AjvSchemaValidator();
    const policyService = new PolicyService(
      policyRepo,
      versionRepo,
      policyValidator,
      policyDispatcher,
    );

    const tCtx = tenantContext(tenantId(args.tenantId));
    return policyService.publishDraft(tCtx, policyVersionId(args.versionId));
  },
});

export const rollback = mutation({
  args: {
    tenantId: v.string(),
    policyId: v.string(),
    targetVersionId: v.string(),
    actorId: v.string(),
  },
  handler: async (ctx, args) => {
    const policyDispatcher = new EventDispatcher<PolicyEventMap>();
    const auditRepo = new ConvexAuditLogRepository(ctx.db);
    void new AuditEventSubscriber(auditRepo, policyDispatcher);

    const policyRepo = new ConvexPolicyRepository(ctx.db);
    const versionRepo = new ConvexPolicyVersionRepository(ctx.db);
    const policyValidator = new AjvSchemaValidator();
    const policyService = new PolicyService(
      policyRepo,
      versionRepo,
      policyValidator,
      policyDispatcher,
    );

    const tCtx = tenantContext(tenantId(args.tenantId), userId(args.actorId));
    return policyService.rollback(tCtx, policyId(args.policyId), policyVersionId(args.targetVersionId), userId(args.actorId));
  },
});
