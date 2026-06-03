import type { TenantContext, UserId, RoleId } from "@/modules/directory/index.js";
import type { ApprovalTaskId, ApprovalChainId } from "../domain/ids.js";
import type { ApprovalTask } from "../domain/approval-task.js";
import type { TaskState } from "../domain/approval-task-state.js";

export interface CreateApprovalTaskInput {
  readonly chainId: ApprovalChainId;
  readonly stageNumber: number;
  readonly approverId: UserId;
  readonly approverRoleId: RoleId;
  readonly state: TaskState;
}

export interface ApprovalTaskRepositoryPort {
  create(ctx: TenantContext, input: CreateApprovalTaskInput): Promise<ApprovalTask>;
  findById(ctx: TenantContext, id: ApprovalTaskId): Promise<ApprovalTask | null>;
  findByChainId(ctx: TenantContext, id: ApprovalChainId): Promise<ApprovalTask[]>;
  updateState(ctx: TenantContext, id: ApprovalTaskId, state: TaskState): Promise<ApprovalTask>;
}
