import type { TenantId, UserId } from "@/modules/directory/index.js";
import type { RequestEvaluationId } from "@/modules/request/index.js";
import type { ApprovalTaskId, ApprovalChainId } from "./ids.js";

export interface ApprovalTaskApprovedEvent {
  readonly tenantId: TenantId;
  readonly taskId: ApprovalTaskId;
  readonly chainId: ApprovalChainId;
  readonly actorId: UserId;
  readonly timestamp: number;
}

export interface ApprovalTaskRejectedEvent {
  readonly tenantId: TenantId;
  readonly taskId: ApprovalTaskId;
  readonly chainId: ApprovalChainId;
  readonly actorId: UserId;
  readonly timestamp: number;
}

export interface ApprovalRoutingFailedEvent {
  readonly tenantId: TenantId;
  readonly evaluationRecordId: RequestEvaluationId;
  readonly reason: string;
  readonly timestamp: number;
}

export type ApprovalEventMap = {
  readonly ApprovalTaskApproved: ApprovalTaskApprovedEvent;
  readonly ApprovalTaskRejected: ApprovalTaskRejectedEvent;
  readonly ApprovalRoutingFailed: ApprovalRoutingFailedEvent;
};
