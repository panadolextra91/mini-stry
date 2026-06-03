import type { TenantId } from "@/modules/directory/index.js";
import type { RequestEvaluationId } from "@/modules/request/index.js";
import type { ApprovalChainId } from "./ids.js";
import type { ChainStatus } from "./approval-status.js";

export interface ApprovalChain {
  readonly id: ApprovalChainId;
  readonly tenantId: TenantId;
  readonly requestEvaluationId: RequestEvaluationId;
  readonly status: ChainStatus;
  readonly createdAt: number;
}
