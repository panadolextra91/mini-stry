import type { Rule } from "./rule.js";
import type { Decision } from "./decision.js";

/**
 * D-24: Match-first envelope
 */
export interface PolicyContent {
  readonly rules: readonly Rule[];
  readonly defaultDecision: Decision;
}
