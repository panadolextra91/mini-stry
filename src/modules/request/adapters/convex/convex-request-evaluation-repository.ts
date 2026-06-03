import type { TenantContext } from "@/modules/directory/index.js";
import type { RequestEvaluationId } from "../../domain/ids.js";
import type { RequestEvaluation } from "../../domain/request-evaluation.js";
import type { CreateRequestEvaluationInput, RequestEvaluationRepositoryPort } from "../../ports/request-evaluation-repository.port.js";
import type { MutationCtx, QueryCtx } from "../../../../../convex/_generated/server.js";
import { fromTenantId } from "@/modules/directory/adapters/convex/mappers.js";
import { fromPolicyVersionId } from "@/modules/policy/adapters/convex/mappers.js";
import { fromRequestEvaluationId, toRequestEvaluationDomain } from "./mappers.js";

export class ConvexRequestEvaluationRepository implements RequestEvaluationRepositoryPort {
  constructor(private readonly db: MutationCtx["db"] | QueryCtx["db"]) {}

  async create(ctx: TenantContext, input: CreateRequestEvaluationInput): Promise<RequestEvaluation> {
    if (!('insert' in this.db)) throw new Error("Mutations require MutationCtx");
    const id = await this.db.insert("requestEvaluations", {
      tenantId: fromTenantId(ctx.tenantId),
      requestType: input.requestType,
      requestInput: input.requestInput,
      policyVersionId: fromPolicyVersionId(input.policyVersionId),
      decision: input.decision,
      trace: input.trace.map((t) => ({ ruleId: t.ruleId, matched: t.matched })),
      status: input.status,
      errorCode: input.errorCode,
      fieldPath: input.fieldPath,
      createdAt: Date.now(),
    });
    const doc = await this.db.get(id);
    if (!doc) throw new Error("RequestEvaluation creation failed");
    return toRequestEvaluationDomain(doc);
  }

  async findById(ctx: TenantContext, id: RequestEvaluationId): Promise<RequestEvaluation | null> {
    const doc = await this.db.get(fromRequestEvaluationId(id));
    if (!doc) return null;
    if (doc.tenantId !== fromTenantId(ctx.tenantId)) return null; // tenant scoping (CON-01)
    return toRequestEvaluationDomain(doc);
  }

  async findByTenant(ctx: TenantContext): Promise<readonly RequestEvaluation[]> {
    const docs = await this.db
      .query("requestEvaluations")
      .withIndex("by_tenant_created", (q) => q.eq("tenantId", fromTenantId(ctx.tenantId)))
      .collect();
    return docs.map(toRequestEvaluationDomain);
  }
}
