import type { TenantContext } from "@/modules/directory/index.js";
import type { PolicyService } from "@/modules/policy/index.js";
import type { SchemaValidatorPort, EvaluationContext } from "@/modules/runtime/index.js";
import { validateAndEvaluate, EvaluationError } from "@/modules/runtime/index.js";
import type { EventDispatcher } from "@/shared/event-dispatcher.js";
import type { RequestEventMap } from "../domain/request-events.js";
import type { RequestEvaluationRepositoryPort } from "../ports/request-evaluation-repository.port.js";
import type { RequestEvaluation } from "../domain/request-evaluation.js";
import { PolicyNotFoundForRequestType, NoActivePolicyError } from "./errors.js";

export class PolicyRuntimeService {
  constructor(
    private readonly policyService: PolicyService,
    private readonly validator: SchemaValidatorPort,
    private readonly evalRepo: RequestEvaluationRepositoryPort,
    private readonly dispatcher: EventDispatcher<RequestEventMap>,
  ) {}

  async submit(
    ctx: TenantContext,
    input: { requestType: string; context: EvaluationContext },
  ): Promise<RequestEvaluation> {
    // (1) RESOLVE — requestType → policy → active version
    const policy = await this.policyService.findByRequestType(ctx, input.requestType);
    if (!policy) {
      await this.dispatcher.emit("ResolutionFailed", {
        tenantId: ctx.tenantId,
        requestType: input.requestType,
        reason: "POLICY_NOT_FOUND",
        timestamp: Date.now(),
      });
      throw new PolicyNotFoundForRequestType(input.requestType);
    }

    const version = await this.policyService.getActiveVersion(ctx, policy.id);
    if (!version) {
      await this.dispatcher.emit("ResolutionFailed", {
        tenantId: ctx.tenantId,
        requestType: input.requestType,
        reason: "NO_ACTIVE_VERSION",
        timestamp: Date.now(),
      });
      throw new NoActivePolicyError(input.requestType);
    }

    // (2) EVALUATE — validateAndEvaluate for RUN-03 defense-in-depth
    try {
      const result = validateAndEvaluate(this.validator, version.content, input.context);

      // (3a) SUCCESS
      const record = await this.evalRepo.create(ctx, {
        requesterId: ctx.actorId ?? null,
        requestType: input.requestType,
        requestInput: input.context,
        policyVersionId: version.id,
        decision: result.decision,
        trace: result.evaluationTrace,
        status: "completed",
        errorCode: null,
        fieldPath: null,
      });

      await this.dispatcher.emit("RequestEvaluated", {
        tenantId: ctx.tenantId,
        evaluationRecordId: record.id,
        timestamp: Date.now(),
      });

      return record;
    } catch (err) {
      // (3b) CONTRACT VIOLATION — EvaluationError only
      if (err instanceof EvaluationError) {
        const record = await this.evalRepo.create(ctx, {
          requesterId: ctx.actorId ?? null,
          requestType: input.requestType,
          requestInput: input.context,
          policyVersionId: version.id,
          decision: null,
          trace: [], // v1: empty trace on failure (D-42 — no evaluator-contract change)
          status: "failed",
          errorCode: err.code,
          fieldPath: err.field, // EvaluationError.field → entity.fieldPath
        });

        await this.dispatcher.emit("EvaluationFailed", {
          tenantId: ctx.tenantId,
          evaluationRecordId: record.id,
          errorCode: err.code,
          timestamp: Date.now(),
        });

        throw err; // D-40 rethrow
      }

      // Non-EvaluationError (e.g. PolicySchemaInvalidError) — rethrow with NO 'failed' record
      throw err;
    }
  }
}
