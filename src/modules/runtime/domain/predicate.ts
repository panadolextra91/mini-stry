import type { JsonValue } from "./evaluation-context.js";

/**
 * D-26: Operator enum exposes exactly these 8 operators
 */
export type Operator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "in";

/**
 * D-25: Only compare variant in v1
 */
export interface ComparePredicate {
  readonly type: "compare";
  readonly field: string;
  readonly op: Operator;
  readonly value: JsonValue;
}

export type Predicate = ComparePredicate;
