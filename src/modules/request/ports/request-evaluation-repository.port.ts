import type { TenantContext } from "@/modules/directory/index.js";
import type { RequestEvaluationId } from "../domain/ids.js";
import type { RequestEvaluation } from "../domain/request-evaluation.js";
import type { RequestEvaluationStatus } from "../domain/request-evaluation-status.js";
import type { Decision, TraceEntry, EvaluationContext, EvaluationErrorCode } from "@/modules/runtime/index.js";
import type { PolicyVersionId } from "@/modules/policy/index.js";

export interface CreateRequestEvaluationInput {
  readonly requestType: string;
  readonly requestInput: EvaluationContext;
  readonly policyVersionId: PolicyVersionId;
  readonly decision: Decision | null;
  readonly trace: readonly TraceEntry[];
  readonly status: RequestEvaluationStatus;
  readonly errorCode: EvaluationErrorCode | null;
  readonly fieldPath: string | null;
}

export interface RequestEvaluationRepositoryPort {
  create(ctx: TenantContext, input: CreateRequestEvaluationInput): Promise<RequestEvaluation>;
  findById(ctx: TenantContext, id: RequestEvaluationId): Promise<RequestEvaluation | null>;
  findByTenant(ctx: TenantContext): Promise<readonly RequestEvaluation[]>;
}
