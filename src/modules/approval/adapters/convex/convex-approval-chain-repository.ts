import type { TenantContext } from "@/modules/directory/index.js";
import type { RequestEvaluationId } from "@/modules/request/index.js";
import type { ApprovalChainId } from "../../domain/ids.js";
import type { ApprovalChain } from "../../domain/approval-chain.js";
import type { ChainStatus } from "../../domain/approval-status.js";
import type {
  CreateApprovalChainInput,
  ApprovalChainRepositoryPort,
} from "../../ports/approval-chain-repository.port.js";
import type { MutationCtx, QueryCtx } from "../../../../../convex/_generated/server.js";
import { fromTenantId } from "@/modules/directory/adapters/convex/mappers.js";
import { fromRequestEvaluationId } from "@/modules/request/adapters/convex/mappers.js";
import { fromApprovalChainId, toApprovalChainDomain } from "./mappers.js";

export class ConvexApprovalChainRepository implements ApprovalChainRepositoryPort {
  constructor(private readonly db: MutationCtx["db"] | QueryCtx["db"]) {}

  async create(ctx: TenantContext, input: CreateApprovalChainInput): Promise<ApprovalChain> {
    if (!("insert" in this.db)) throw new Error("Mutations require MutationCtx");
    const id = await this.db.insert("approvalChains", {
      tenantId: fromTenantId(ctx.tenantId),
      requestEvaluationId: fromRequestEvaluationId(input.requestEvaluationId),
      status: input.status,
      createdAt: Date.now(),
    });
    const doc = await this.db.get(id);
    if (!doc) throw new Error("ApprovalChain creation failed");
    return toApprovalChainDomain(doc);
  }

  async findById(ctx: TenantContext, id: ApprovalChainId): Promise<ApprovalChain | null> {
    const doc = await this.db.get(fromApprovalChainId(id));
    if (!doc) return null;
    if (doc.tenantId !== fromTenantId(ctx.tenantId)) return null; // tenant scoping (CON-01)
    return toApprovalChainDomain(doc);
  }

  async findByRequestEvaluationId(
    ctx: TenantContext,
    id: RequestEvaluationId,
  ): Promise<ApprovalChain | null> {
    const doc = await this.db
      .query("approvalChains")
      .withIndex("by_tenant_request_evaluation", (q) =>
        q
          .eq("tenantId", fromTenantId(ctx.tenantId))
          .eq("requestEvaluationId", fromRequestEvaluationId(id)),
      )
      .first();
    if (!doc) return null;
    return toApprovalChainDomain(doc);
  }

  async updateStatus(
    ctx: TenantContext,
    id: ApprovalChainId,
    status: ChainStatus,
  ): Promise<ApprovalChain> {
    if (!("patch" in this.db)) throw new Error("Mutations require MutationCtx");
    const rawId = fromApprovalChainId(id);
    const existing = await this.db.get(rawId);
    if (!existing) throw new Error(`ApprovalChain ${id} not found`);
    if (existing.tenantId !== fromTenantId(ctx.tenantId)) {
      throw new Error(`ApprovalChain ${id} does not belong to tenant`);
    }
    await this.db.patch(rawId, { status });
    const doc = await this.db.get(rawId);
    if (!doc) throw new Error("ApprovalChain retrieval failed after patch");
    return toApprovalChainDomain(doc);
  }
}
