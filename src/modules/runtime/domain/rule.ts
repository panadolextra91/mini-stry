import type { RuleId } from "./ids.js";
import type { Predicate } from "./predicate.js";
import type { Decision } from "./decision.js";

export interface Rule {
  readonly id: RuleId;
  readonly when: Predicate;
  readonly decision: Decision;
}
