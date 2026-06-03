import type { TenantId, UserId } from "@/modules/directory/index.js";
import type { PolicyVersionId } from "@/modules/policy/index.js";
import type {
  Decision,
  TraceEntry,
  EvaluationContext,
  EvaluationErrorCode,
} from "@/modules/runtime/index.js";
import type { RequestEvaluationId } from "./ids.js";
import type { RequestEvaluationStatus } from "./request-evaluation-status.js";

export interface RequestEvaluation {
  readonly id: RequestEvaluationId;
  readonly tenantId: TenantId;
  readonly requesterId: UserId | null;
  readonly requestType: string;
  readonly requestInput: EvaluationContext;
  readonly policyVersionId: PolicyVersionId;
  readonly decision: Decision | null;
  readonly trace: readonly TraceEntry[];
  readonly status: RequestEvaluationStatus;
  readonly errorCode: EvaluationErrorCode | null;
  readonly fieldPath: string | null;
  readonly createdAt: number;
}
