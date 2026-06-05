/**
 * convex/ HARD RULE:
 * Allowed: validate input shape, instantiate dependencies, call application services, map responses.
 * Forbidden: evaluate policies, enforce business rules, perform approval routing, contain domain logic.
 */
import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import { EventDispatcher } from "../src/shared/event-dispatcher.js";
import {
  ApprovalRoutingService,
  ApprovalAuditSubscriber,
  ConvexApprovalChainRepository,
  ConvexApprovalTaskRepository,
  approvalTaskId,
} from "../src/modules/approval/index.js";
import type { ApprovalEventMap } from "../src/modules/approval/index.js";
import { ConvexUserRepository } from "../src/modules/directory/adapters/convex/convex-user-repository.js";
import { ConvexRoleRepository } from "../src/modules/directory/adapters/convex/convex-role-repository.js";
import { ConvexAuditLogRepository } from "../src/modules/audit/index.js";
import { ConvexRequestEvaluationRepository } from "../src/modules/request/index.js";
import { tenantContext, tenantId, userId } from "../src/modules/directory/index.js";

export const listInbox = query({
  args: { tenantId: v.string(), actorId: v.string() },
  handler: async (ctx, args) => {
    const repo = new ConvexApprovalTaskRepository(ctx.db);
    return repo.findByApprover(tenantContext(tenantId(args.tenantId)), userId(args.actorId));
  },
});

export const approve = mutation({
  args: { tenantId: v.string(), actorId: v.string(), taskId: v.string() },
  handler: async (ctx, args) => {
    const userRepo = new ConvexUserRepository(ctx.db);
    const roleRepo = new ConvexRoleRepository(ctx.db);
    const chainRepo = new ConvexApprovalChainRepository(ctx.db);
    const taskRepo = new ConvexApprovalTaskRepository(ctx.db);
    const auditRepo = new ConvexAuditLogRepository(ctx.db);
    const evalRepo = new ConvexRequestEvaluationRepository(ctx.db);

    const approvalDispatcher = new EventDispatcher<ApprovalEventMap>();
    void new ApprovalAuditSubscriber(auditRepo, approvalDispatcher);

    const routingService = new ApprovalRoutingService(
      chainRepo,
      taskRepo,
      userRepo,
      roleRepo,
      evalRepo,
      approvalDispatcher,
    );

    const tCtx = tenantContext(tenantId(args.tenantId), userId(args.actorId));
    return routingService.act(tCtx, approvalTaskId(args.taskId), "APPROVE");
  },
});

export const reject = mutation({
  args: { tenantId: v.string(), actorId: v.string(), taskId: v.string() },
  handler: async (ctx, args) => {
    const userRepo = new ConvexUserRepository(ctx.db);
    const roleRepo = new ConvexRoleRepository(ctx.db);
    const chainRepo = new ConvexApprovalChainRepository(ctx.db);
    const taskRepo = new ConvexApprovalTaskRepository(ctx.db);
    const auditRepo = new ConvexAuditLogRepository(ctx.db);
    const evalRepo = new ConvexRequestEvaluationRepository(ctx.db);

    const approvalDispatcher = new EventDispatcher<ApprovalEventMap>();
    void new ApprovalAuditSubscriber(auditRepo, approvalDispatcher);

    const routingService = new ApprovalRoutingService(
      chainRepo,
      taskRepo,
      userRepo,
      roleRepo,
      evalRepo,
      approvalDispatcher,
    );

    const tCtx = tenantContext(tenantId(args.tenantId), userId(args.actorId));
    return routingService.act(tCtx, approvalTaskId(args.taskId), "REJECT");
  },
});
