import type { TenantContext } from "@/modules/directory/index.js";
import type { RequestEvaluationId } from "../../domain/ids.js";
import { requestEvaluationId as buildRequestEvaluationId } from "../../domain/ids.js";
import type { RequestEvaluation } from "../../domain/request-evaluation.js";
import type { CreateRequestEvaluationInput, RequestEvaluationRepositoryPort } from "../../ports/request-evaluation-repository.port.js";

export class InMemoryRequestEvaluationRepository implements RequestEvaluationRepositoryPort {
  private readonly records = new Map<RequestEvaluationId, RequestEvaluation>();
  private idCounter = 1;

  async create(ctx: TenantContext, input: CreateRequestEvaluationInput): Promise<RequestEvaluation> {
    const id = buildRequestEvaluationId(`eval_${this.idCounter++}`);
    const record: RequestEvaluation = {
      id,
      tenantId: ctx.tenantId,
      requestType: input.requestType,
      requestInput: input.requestInput,
      policyVersionId: input.policyVersionId,
      decision: input.decision,
      trace: input.trace,
      status: input.status,
      errorCode: input.errorCode,
      fieldPath: input.fieldPath,
      createdAt: Date.now(),
    };
    this.records.set(id, record);
    return record;
  }

  async findById(ctx: TenantContext, id: RequestEvaluationId): Promise<RequestEvaluation | null> {
    const record = this.records.get(id);
    if (!record) return null;
    if (record.tenantId !== ctx.tenantId) return null; // tenant scoping (CON-01)
    return record;
  }

  async findByTenant(ctx: TenantContext): Promise<readonly RequestEvaluation[]> {
    return [...this.records.values()].filter((r) => r.tenantId === ctx.tenantId);
  }
}
