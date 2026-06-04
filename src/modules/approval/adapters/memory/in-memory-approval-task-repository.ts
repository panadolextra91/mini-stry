import type { TenantContext, UserId } from "@/modules/directory/index.js";
import type { ApprovalTaskId, ApprovalChainId } from "../../domain/ids.js";
import { approvalTaskId as buildApprovalTaskId } from "../../domain/ids.js";
import type { ApprovalTask } from "../../domain/approval-task.js";
import type { TaskState } from "../../domain/approval-task-state.js";
import type {
  CreateApprovalTaskInput,
  ApprovalTaskRepositoryPort,
} from "../../ports/approval-task-repository.port.js";

export class InMemoryApprovalTaskRepository implements ApprovalTaskRepositoryPort {
  private readonly records = new Map<ApprovalTaskId, ApprovalTask>();
  private idCounter = 1;

  async create(ctx: TenantContext, input: CreateApprovalTaskInput): Promise<ApprovalTask> {
    const id = buildApprovalTaskId(`task_${this.idCounter++}`);
    const record: ApprovalTask = {
      id,
      tenantId: ctx.tenantId,
      chainId: input.chainId,
      stageNumber: input.stageNumber,
      approverId: input.approverId,
      approverRoleId: input.approverRoleId,
      state: input.state,
      createdAt: Date.now(),
    };
    this.records.set(id, record);
    return record;
  }

  async findById(ctx: TenantContext, id: ApprovalTaskId): Promise<ApprovalTask | null> {
    const record = this.records.get(id);
    if (!record) return null;
    if (record.tenantId !== ctx.tenantId) return null; // tenant scoping (CON-01)
    return record;
  }

  async findByChainId(ctx: TenantContext, id: ApprovalChainId): Promise<ApprovalTask[]> {
    return [...this.records.values()].filter(
      (r) => r.tenantId === ctx.tenantId && r.chainId === id,
    );
  }

  async findByApprover(ctx: TenantContext, approverId: UserId): Promise<ApprovalTask[]> {
    return [...this.records.values()].filter(
      (r) => r.tenantId === ctx.tenantId && r.approverId === approverId,
    ).reverse();
  }

  async updateState(
    ctx: TenantContext,
    id: ApprovalTaskId,
    state: TaskState,
  ): Promise<ApprovalTask> {
    const record = await this.findById(ctx, id);
    if (!record) {
      throw new Error(`Approval task ${id} not found in this tenant`);
    }
    const updated: ApprovalTask = {
      ...record,
      state,
    };
    this.records.set(id, updated);
    return updated;
  }
}
