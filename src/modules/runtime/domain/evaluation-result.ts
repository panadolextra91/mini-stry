import type { RuleId } from "./ids.js";
import type { Decision } from "./decision.js";

export interface TraceEntry {
  readonly ruleId: RuleId;
  readonly matched: boolean;
}

/**
 * D-30: Trace as first-class runtime output
 */
export interface EvaluationResult {
  readonly decision: Decision;
  readonly matchedRuleId: RuleId | null;
  readonly evaluationTrace: readonly TraceEntry[];
}
