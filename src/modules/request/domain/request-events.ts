import type { TenantId } from "@/modules/directory/index.js";
import type { RequestEvaluationId } from "./ids.js";
import type { EvaluationErrorCode } from "@/modules/runtime/index.js";

export interface RequestEvaluatedEvent {
  readonly tenantId: TenantId;
  readonly evaluationRecordId: RequestEvaluationId;
  readonly timestamp: number;
}

export interface EvaluationFailedEvent {
  readonly tenantId: TenantId;
  readonly evaluationRecordId: RequestEvaluationId;
  readonly errorCode: EvaluationErrorCode;
  readonly timestamp: number;
}

export interface ResolutionFailedEvent {
  readonly tenantId: TenantId;
  readonly requestType: string;
  readonly reason: string;
  readonly timestamp: number;
}

export type RequestEventMap = {
  RequestEvaluated: RequestEvaluatedEvent;
  EvaluationFailed: EvaluationFailedEvent;
  ResolutionFailed: ResolutionFailedEvent;
};

