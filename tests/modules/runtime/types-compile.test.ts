import type {
  JsonScalar, JsonValue, EvaluationContext, Operator,
  ComparePredicate, Predicate, Rule, PolicyContent,
  Decision, TraceEntry, EvaluationResult, RuleId,
  SchemaValidatorPort, ValidationResult, ValidationSuccess, ValidationFailure,
  EvaluationErrorCode,
} from "@/modules/runtime/index.js";
import {
  ruleId, autoApprove, autoReject, requestApproval,
  evaluate, validateAndEvaluate,
  AjvSchemaValidator, ValidationError, EvaluationError, PolicySchemaInvalidError,
} from "@/modules/runtime/index.js";
import { roleId } from "@/modules/directory/index.js";
import { describe, it, expect } from "vitest";

describe("runtime public surface", () => {
  it("exports every documented symbol", () => {
    // Construct one value from each type to force compile-time usage.
    const _id: RuleId = ruleId("R1");
    const _scalar: JsonScalar = 1;
    const _value: JsonValue = [1, 2, 3];
    const _ctx: EvaluationContext = { x: 1 };
    const _op: Operator = "eq";
    const _pred: ComparePredicate = { type: "compare", field: "x", op: _op, value: _value };
    const _predU: Predicate = _pred;
    const _rule: Rule = { id: _id, when: _pred, decision: autoApprove() };
    const _policy: PolicyContent = { rules: [_rule], defaultDecision: autoReject() };
    const _decisionVariants: Decision[] = [autoApprove(), autoReject(), requestApproval(roleId("R"))];
    const _trace: TraceEntry = { ruleId: _id, matched: true };
    const _result: EvaluationResult = { decision: _decisionVariants[0]!, matchedRuleId: _id, evaluationTrace: [_trace] };
    const _validator: SchemaValidatorPort = new AjvSchemaValidator();
    // REFINEMENT: ValidationSuccess carries the typed PolicyContent payload.
    const _vrOk: ValidationSuccess = { ok: true, value: _policy };
    const _vrErr: ValidationFailure = { ok: false, errors: [new ValidationError("test", "/", "msg")] };
    const _vr: ValidationResult = _vrOk;
    const _errCode: EvaluationErrorCode = "MISSING_FIELD";
    const _veErr = new ValidationError("test", "/", "msg");
    const _evErr = new EvaluationError(_errCode, "f", "msg");
    const _psie = new PolicySchemaInvalidError([_veErr]);

    expect(typeof evaluate).toBe("function");
    expect(typeof validateAndEvaluate).toBe("function");
    expect(_validator).toBeInstanceOf(AjvSchemaValidator);
    // Narrowing sanity check
    if (_vr.ok) {
      const _narrowed: PolicyContent = _vr.value;
      void _narrowed;
    }
    // Silence unused-let lints
    void _scalar; void _value; void _ctx; void _predU; void _policy;
    void _result; void _vrOk; void _vrErr; void _evErr; void _psie;
  });
});
