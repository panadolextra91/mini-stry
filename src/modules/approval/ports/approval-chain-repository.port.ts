import type { TenantContext } from "@/modules/directory/index.js";
import type { RequestEvaluationId } from "@/modules/request/index.js";
import type { ApprovalChainId } from "../domain/ids.js";
import type { ApprovalChain } from "../domain/approval-chain.js";
import type { ChainStatus } from "../domain/approval-status.js";

export interface CreateApprovalChainInput {
  readonly requestEvaluationId: RequestEvaluationId;
  readonly status: ChainStatus;
}

export interface ApprovalChainRepositoryPort {
  create(ctx: TenantContext, input: CreateApprovalChainInput): Promise<ApprovalChain>;
  findById(ctx: TenantContext, id: ApprovalChainId): Promise<ApprovalChain | null>;
  findByRequestEvaluationId(
    ctx: TenantContext,
    id: RequestEvaluationId,
  ): Promise<ApprovalChain | null>;
  updateStatus(
    ctx: TenantContext,
    id: ApprovalChainId,
    status: ChainStatus,
  ): Promise<ApprovalChain>;
}
