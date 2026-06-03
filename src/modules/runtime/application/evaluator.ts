import type { PolicyContent } from "../domain/policy-content.js";
import type { EvaluationContext } from "../domain/evaluation-context.js";
import type { EvaluationResult, TraceEntry } from "../domain/evaluation-result.js";
import type { Predicate } from "../domain/predicate.js";
import { evaluateCompare } from "./operators.js";
import { EvaluationError } from "./errors.js";

export function evaluate(policy: PolicyContent, ctx: EvaluationContext): EvaluationResult {
  const trace: TraceEntry[] = [];
  for (const rule of policy.rules) {
    const matched = evaluatePredicate(rule.when, ctx);
    trace.push({ ruleId: rule.id, matched });
    if (matched) {
      return {
        decision: rule.decision,
        matchedRuleId: rule.id,
        evaluationTrace: trace,
      };
    }
  }
  return {
    decision: policy.defaultDecision,
    matchedRuleId: null,
    evaluationTrace: trace,
  };
}

function evaluatePredicate(p: Predicate, ctx: EvaluationContext): boolean {
  // Predicate is a one-member union in v1; the switch is a safety net for v2.
  switch (p.type) {
    case "compare":
      return evaluateCompare(p.field, p.op, p.value, ctx);
    default:
      return assertNeverPredicate(p as never);
  }
}

function assertNeverPredicate(p: never): never {
  throw new EvaluationError(
    "UNSUPPORTED_OPERATOR",
    null,
    `Predicate type not supported: ${String((p as { type?: string }).type ?? "unknown")}`,
  );
}
