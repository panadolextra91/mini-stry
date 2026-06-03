import type { TenantContext } from "@/modules/directory/index.js";
import type { RequestEvaluationId } from "@/modules/request/index.js";
import type { ApprovalChainId } from "../../domain/ids.js";
import { approvalChainId as buildApprovalChainId } from "../../domain/ids.js";
import type { ApprovalChain } from "../../domain/approval-chain.js";
import type { ChainStatus } from "../../domain/approval-status.js";
import type {
  CreateApprovalChainInput,
  ApprovalChainRepositoryPort,
} from "../../ports/approval-chain-repository.port.js";

export class InMemoryApprovalChainRepository implements ApprovalChainRepositoryPort {
  private readonly records = new Map<ApprovalChainId, ApprovalChain>();
  private idCounter = 1;

  async create(ctx: TenantContext, input: CreateApprovalChainInput): Promise<ApprovalChain> {
    const id = buildApprovalChainId(`chain_${this.idCounter++}`);
    const record: ApprovalChain = {
      id,
      tenantId: ctx.tenantId,
      requestEvaluationId: input.requestEvaluationId,
      status: input.status,
      createdAt: Date.now(),
    };
    this.records.set(id, record);
    return record;
  }

  async findById(ctx: TenantContext, id: ApprovalChainId): Promise<ApprovalChain | null> {
    const record = this.records.get(id);
    if (!record) return null;
    if (record.tenantId !== ctx.tenantId) return null; // tenant scoping (CON-01)
    return record;
  }

  async findByRequestEvaluationId(
    ctx: TenantContext,
    id: RequestEvaluationId,
  ): Promise<ApprovalChain | null> {
    const records = [...this.records.values()].filter(
      (r) => r.tenantId === ctx.tenantId && r.requestEvaluationId === id,
    );
    return records[0] ?? null;
  }

  async updateStatus(
    ctx: TenantContext,
    id: ApprovalChainId,
    status: ChainStatus,
  ): Promise<ApprovalChain> {
    const record = await this.findById(ctx, id);
    if (!record) {
      throw new Error(`Approval chain ${id} not found in this tenant`);
    }
    const updated: ApprovalChain = {
      ...record,
      status,
    };
    this.records.set(id, updated);
    return updated;
  }
}
