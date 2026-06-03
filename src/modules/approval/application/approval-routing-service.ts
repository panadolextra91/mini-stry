import type {
  TenantContext,
  TenantId,
  UserId,
  RoleId,
  UserRepositoryPort,
  RoleRepositoryPort,
} from "@/modules/directory/index.js";

import { RoleNotFoundError } from "@/modules/directory/index.js";
import type {
  RequestEvaluationId,
  RequestEvaluationRepositoryPort,
} from "@/modules/request/index.js";
import type { EventDispatcher } from "@/shared/event-dispatcher.js";
import type { ApprovalChainRepositoryPort } from "../ports/approval-chain-repository.port.js";
import type { ApprovalTaskRepositoryPort } from "../ports/approval-task-repository.port.js";
import type { ApprovalEventMap } from "../domain/approval-events.js";
import type { ApprovalTaskId } from "../domain/ids.js";
import { transitionTask, deriveChainStatus } from "../domain/state-machine.js";
import {
  RoutingError,
  HierarchyTraversalError,
  TaskAlreadyResolvedError,
  UnauthorizedApproverError,
} from "./errors.js";

export class ApprovalRoutingService {
  constructor(
    private readonly chainRepo: ApprovalChainRepositoryPort,
    private readonly taskRepo: ApprovalTaskRepositoryPort,
    private readonly userRepo: UserRepositoryPort,
    private readonly roleRepo: RoleRepositoryPort,
    private readonly evalRepo: RequestEvaluationRepositoryPort,
    private readonly dispatcher: EventDispatcher<ApprovalEventMap>,
  ) {}

  async onRequestEvaluated(
    ctx: TenantContext,
    event: {
      readonly tenantId: TenantId;
      readonly evaluationRecordId: RequestEvaluationId;
      readonly timestamp: number;
    },
  ): Promise<void> {
    try {
      // 1. Check idempotency: chainRepo.findByRequestEvaluationId(ctx, event.evaluationRecordId)
      const existingChain = await this.chainRepo.findByRequestEvaluationId(
        ctx,
        event.evaluationRecordId,
      );
      if (existingChain) {
        return;
      }

      // 2. Read evaluation
      const evaluation = await this.evalRepo.findById(ctx, event.evaluationRecordId);
      if (!evaluation) {
        throw new RoutingError(
          null as unknown as UserId,
          null as unknown as RoleId,
          "Evaluation not found",
        );
      }

      // 3. Ignore non-request-approval decisions
      const decision = evaluation.decision;
      if (decision?.kind !== "request-approval") {
        return;
      }

      const { requesterId } = evaluation;

      // 4. Null requester guard
      if (requesterId === null) {
        throw new RoutingError(null as unknown as UserId, decision.targetRoleId, "no requester");
      }

      // 5. Verify role exists
      const role = await this.roleRepo.findById(ctx, decision.targetRoleId);
      if (!role) {
        throw new RoleNotFoundError(decision.targetRoleId);
      }

      // 6. Walk manager chain
      const requester = await this.userRepo.findById(ctx, requesterId);
      if (!requester) {
        throw new RoutingError(requesterId, decision.targetRoleId, "requester not found");
      }

      let currentUserId: UserId | null = requester.managerId;
      let depth = 0;
      let resolvedApproverId: UserId | null = null;

      while (currentUserId !== null) {
        if (depth >= 50) {
          throw new HierarchyTraversalError("Manager chain exceeds maximum depth of 50");
        }
        const currentUser = await this.userRepo.findById(ctx, currentUserId);
        if (!currentUser) {
          throw new RoutingError(
            requesterId,
            decision.targetRoleId,
            `manager ${currentUserId} not found`,
          );
        }
        if (currentUser.roleId === decision.targetRoleId) {
          resolvedApproverId = currentUser.id;
          break;
        }
        currentUserId = currentUser.managerId;
        depth++;
      }

      if (!resolvedApproverId) {
        throw new RoutingError(
          requesterId,
          decision.targetRoleId,
          "no manager in the chain has the required role",
        );
      }

      // 7. Materialize
      const chain = await this.chainRepo.create(ctx, {
        requestEvaluationId: event.evaluationRecordId,
        status: "IN_PROGRESS",
      });

      await this.taskRepo.create(ctx, {
        chainId: chain.id,
        stageNumber: 1,
        approverId: resolvedApproverId,
        approverRoleId: decision.targetRoleId,
        state: "PENDING",
      });
    } catch (err) {
      if (
        err instanceof RoutingError ||
        err instanceof RoleNotFoundError ||
        err instanceof HierarchyTraversalError
      ) {
        await this.dispatcher.emit("ApprovalRoutingFailed", {
          tenantId: event.tenantId,
          evaluationRecordId: event.evaluationRecordId,
          reason: err.message,
          timestamp: Date.now(),
        });
        return;
      }
      throw err;
    }
  }

  async act(
    ctx: TenantContext,
    taskId: ApprovalTaskId,
    action: "APPROVE" | "REJECT",
  ): Promise<void> {
    const task = await this.taskRepo.findById(ctx, taskId);
    if (!task) {
      throw new TaskAlreadyResolvedError(taskId, `Approval task ${taskId} not found`);
    }

    if (task.state !== "PENDING") {
      throw new TaskAlreadyResolvedError(taskId);
    }

    if (ctx.actorId !== task.approverId) {
      throw new UnauthorizedApproverError();
    }

    const nextState = transitionTask(task.state, action);
    await this.taskRepo.updateState(ctx, taskId, nextState);

    const tasksInChain = await this.taskRepo.findByChainId(ctx, task.chainId);
    const states = tasksInChain.map((t) => (t.id === taskId ? nextState : t.state));
    const nextChainStatus = deriveChainStatus(states);

    await this.chainRepo.updateStatus(ctx, task.chainId, nextChainStatus);

    await this.dispatcher.emit(
      action === "APPROVE" ? "ApprovalTaskApproved" : "ApprovalTaskRejected",
      {
        tenantId: ctx.tenantId,
        taskId: task.id,
        chainId: task.chainId,
        actorId: ctx.actorId!,
        timestamp: Date.now(),
      },
    );
  }
}
