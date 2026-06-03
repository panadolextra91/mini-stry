import type { TenantId, UserId, RoleId } from "@/modules/directory/index.js";
import type { ApprovalTaskId, ApprovalChainId } from "./ids.js";
import type { TaskState } from "./approval-task-state.js";

export interface ApprovalTask {
  readonly id: ApprovalTaskId;
  readonly tenantId: TenantId;
  readonly chainId: ApprovalChainId;
  readonly stageNumber: number;
  readonly approverId: UserId;
  readonly approverRoleId: RoleId;
  readonly state: TaskState;
  readonly createdAt: number;
}
