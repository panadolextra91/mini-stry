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
import { RequestAuditSubscriber, ConvexAuditLogRepository } from "../src/modules/audit/index.js";
import { PolicyRuntimeService, ConvexRequestEvaluationRepository, requestEvaluationId } from "../src/modules/request/index.js";
import type { RequestEventMap } from "../src/modules/request/index.js";
import { tenantContext, tenantId } from "../src/modules/directory/index.js";

export const submitRequest = mutation({
  args: {
    tenantId: v.string(),
    requestType: v.string(),
    context: v.any(),
  },
  handler: async (ctx, args) => {
    const requestDispatcher = new EventDispatcher<RequestEventMap>();
    const auditRepo = new ConvexAuditLogRepository(ctx.db);
    // Wired via constructor side-effect
    void new RequestAuditSubscriber(auditRepo, requestDispatcher);

    const policyDispatcher = new EventDispatcher<PolicyEventMap>();
    const policyRepo = new ConvexPolicyRepository(ctx.db);
    const versionRepo = new ConvexPolicyVersionRepository(ctx.db);
    const policyValidator = new AjvSchemaValidator();
    const policyService = new PolicyService(
      policyRepo,
      versionRepo,
      policyValidator,
      policyDispatcher,
    );

    const runtimeValidator = new AjvSchemaValidator();
    const evalRepo = new ConvexRequestEvaluationRepository(ctx.db);
    const service = new PolicyRuntimeService(
      policyService,
      runtimeValidator,
      evalRepo,
      requestDispatcher,
    );

    const tCtx = tenantContext(tenantId(args.tenantId));
    return service.submit(tCtx, {
      requestType: args.requestType,
      context: args.context,
    });
  },
});

export const getRequestEvaluation = query({
  args: {
    tenantId: v.string(),
    id: v.string(),
  },
  handler: async (ctx, args) => {
    const evalRepo = new ConvexRequestEvaluationRepository(ctx.db);
    const tCtx = tenantContext(tenantId(args.tenantId));
    return evalRepo.findById(tCtx, requestEvaluationId(args.id));
  },
});
