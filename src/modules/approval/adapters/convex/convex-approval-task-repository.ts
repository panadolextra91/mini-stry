import type { TenantContext, UserId } from "@/modules/directory/index.js";
import type { ApprovalTaskId, ApprovalChainId } from "../../domain/ids.js";
import type { ApprovalTask } from "../../domain/approval-task.js";
import type { TaskState } from "../../domain/approval-task-state.js";
import type {
  CreateApprovalTaskInput,
  ApprovalTaskRepositoryPort,
} from "../../ports/approval-task-repository.port.js";
import type { MutationCtx, QueryCtx } from "../../../../../convex/_generated/server.js";
import {
  fromTenantId,
  fromUserId,
  fromRoleId,
} from "@/modules/directory/adapters/convex/mappers.js";
import { fromApprovalChainId, fromApprovalTaskId, toApprovalTaskDomain } from "./mappers.js";

export class ConvexApprovalTaskRepository implements ApprovalTaskRepositoryPort {
  constructor(private readonly db: MutationCtx["db"] | QueryCtx["db"]) {}

  async create(ctx: TenantContext, input: CreateApprovalTaskInput): Promise<ApprovalTask> {
    if (!("insert" in this.db)) throw new Error("Mutations require MutationCtx");
    const id = await this.db.insert("approvalTasks", {
      tenantId: fromTenantId(ctx.tenantId),
      chainId: fromApprovalChainId(input.chainId),
      stageNumber: input.stageNumber,
      approverId: fromUserId(input.approverId),
      approverRoleId: fromRoleId(input.approverRoleId),
      state: input.state,
      createdAt: Date.now(),
    });
    const doc = await this.db.get(id);
    if (!doc) throw new Error("ApprovalTask creation failed");
    return toApprovalTaskDomain(doc);
  }

  async findById(ctx: TenantContext, id: ApprovalTaskId): Promise<ApprovalTask | null> {
    const doc = await this.db.get(fromApprovalTaskId(id));
    if (!doc) return null;
    if (doc.tenantId !== fromTenantId(ctx.tenantId)) return null; // tenant scoping (CON-01)
    return toApprovalTaskDomain(doc);
  }

  async findByChainId(ctx: TenantContext, id: ApprovalChainId): Promise<ApprovalTask[]> {
    const docs = await this.db
      .query("approvalTasks")
      .withIndex("by_tenant_chain", (q) =>
        q.eq("tenantId", fromTenantId(ctx.tenantId)).eq("chainId", fromApprovalChainId(id)),
      )
      .collect();
    return docs.map(toApprovalTaskDomain);
  }

  async findByApprover(ctx: TenantContext, approverId: UserId): Promise<ApprovalTask[]> {
    const docs = await this.db
      .query("approvalTasks")
      .withIndex("by_tenant_approver", (q) =>
        q.eq("tenantId", fromTenantId(ctx.tenantId)).eq("approverId", fromUserId(approverId)),
      )
      .order("desc")
      .take(100);
    return docs.map(toApprovalTaskDomain);
  }

  async updateState(
    ctx: TenantContext,
    id: ApprovalTaskId,
    state: TaskState,
  ): Promise<ApprovalTask> {
    if (!("patch" in this.db)) throw new Error("Mutations require MutationCtx");
    const rawId = fromApprovalTaskId(id);
    const existing = await this.db.get(rawId);
    if (!existing) throw new Error(`ApprovalTask ${id} not found`);
    if (existing.tenantId !== fromTenantId(ctx.tenantId)) {
      throw new Error(`ApprovalTask ${id} does not belong to tenant`);
    }
    await this.db.patch(rawId, { state });
    const doc = await this.db.get(rawId);
    if (!doc) throw new Error("ApprovalTask retrieval failed after patch");
    return toApprovalTaskDomain(doc);
  }
}
