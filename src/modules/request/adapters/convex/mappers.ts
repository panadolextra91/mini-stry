import {
  requestEvaluationId as buildRequestEvaluationId,
  type RequestEvaluationId,
} from "../../domain/ids.js";
import type { RequestEvaluation } from "../../domain/request-evaluation.js";
import type { RequestEvaluationStatus } from "../../domain/request-evaluation-status.js";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel.js";
import { toTenantId, toUserId } from "@/modules/directory/adapters/convex/mappers.js";
import { toPolicyVersionId } from "@/modules/policy/adapters/convex/mappers.js";
import type { Decision, EvaluationContext, EvaluationErrorCode } from "@/modules/runtime/index.js";
import { ruleId } from "@/modules/runtime/index.js";

// ID Mappers
export const toRequestEvaluationId = (raw: Id<"requestEvaluations">): RequestEvaluationId =>
  buildRequestEvaluationId(raw);
export const fromRequestEvaluationId = (brand: RequestEvaluationId): Id<"requestEvaluations"> =>
  brand as string as Id<"requestEvaluations">;

// Entity Mapper
export const toRequestEvaluationDomain = (doc: Doc<"requestEvaluations">): RequestEvaluation => ({
  id: toRequestEvaluationId(doc._id),
  tenantId: toTenantId(doc.tenantId),
  requesterId: (doc as Record<string, unknown>).requesterId
    ? toUserId((doc as Record<string, unknown>).requesterId as Id<"users">)
    : null,
  requestType: doc.requestType,
  requestInput: doc.requestInput as EvaluationContext,
  policyVersionId: toPolicyVersionId(doc.policyVersionId),
  decision: doc.decision as Decision | null,
  trace: doc.trace.map((t) => ({ ruleId: ruleId(t.ruleId), matched: t.matched })),
  status: doc.status as RequestEvaluationStatus,
  errorCode: doc.errorCode as EvaluationErrorCode | null,
  fieldPath: doc.fieldPath,
  createdAt: doc.createdAt,
});
