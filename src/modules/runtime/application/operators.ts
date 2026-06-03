import type { Operator } from "../domain/predicate.js";
import type { JsonValue, EvaluationContext } from "../domain/evaluation-context.js";
import { EvaluationError } from "./errors.js";

export function evaluateCompare(
  field: string,
  op: Operator,
  value: JsonValue,
  ctx: EvaluationContext,
): boolean {
  if (!Object.prototype.hasOwnProperty.call(ctx, field)) {
    throw new EvaluationError(
      "MISSING_FIELD",
      field,
      `Field "${field}" missing from EvaluationContext`,
    );
  }
  const fv = ctx[field] as JsonValue;

  // Number-vs-Number ops
  if (typeof fv === "number") {
    switch (op) {
      case "eq":
        return numEq(fv, value, field);
      case "neq":
        return !numEq(fv, value, field);
      case "gt":
        return numGt(fv, value, field, ">");
      case "gte":
        return numGt(fv, value, field, ">=") || numEq(fv, value, field);
      case "lt":
        return numLt(fv, value, field, "<");
      case "lte":
        return numLt(fv, value, field, "<=") || numEq(fv, value, field);
      case "in":
        return numIn(fv, value, field);
      case "contains":
        throw new EvaluationError(
          "TYPE_MISMATCH",
          field,
          `Operator "contains" is not supported on Number fields (field: ${field})`,
        );
      default:
        return assertNeverOperator(op, field);
    }
  }

  // String-vs-String ops
  if (typeof fv === "string") {
    switch (op) {
      case "eq":
        return strEq(fv, value, field);
      case "neq":
        return !strEq(fv, value, field);
      case "contains":
        return strContains(fv, value, field);
      case "in":
        return strIn(fv, value, field);
      case "gt":
      case "gte":
      case "lt":
      case "lte":
        throw new EvaluationError(
          "TYPE_MISMATCH",
          field,
          `Operator "${op}" is not supported on String fields (field: ${field})`,
        );
      default:
        return assertNeverOperator(op, field);
    }
  }

  throw new EvaluationError(
    "TYPE_MISMATCH",
    field,
    `Field "${field}" has unsupported type for compare predicate (got ${describe(fv)})`,
  );
}

function numEq(a: number, v: JsonValue, field: string): boolean {
  if (typeof v !== "number") {
    throw new EvaluationError(
      "TYPE_MISMATCH",
      field,
      `Operator "eq" expects number value, got ${describe(v)}`,
    );
  }
  return a === v;
}

function numGt(a: number, v: JsonValue, field: string, label: string): boolean {
  if (typeof v !== "number") {
    throw new EvaluationError(
      "TYPE_MISMATCH",
      field,
      `Operator "${label}" expects number value, got ${describe(v)}`,
    );
  }
  return a > v;
}

function numLt(a: number, v: JsonValue, field: string, label: string): boolean {
  if (typeof v !== "number") {
    throw new EvaluationError(
      "TYPE_MISMATCH",
      field,
      `Operator "${label}" expects number value, got ${describe(v)}`,
    );
  }
  return a < v;
}

function numIn(a: number, v: JsonValue, field: string): boolean {
  if (!Array.isArray(v) || !v.every((x) => typeof x === "number")) {
    throw new EvaluationError(
      "TYPE_MISMATCH",
      field,
      `Operator "in" expects array of numbers, got ${describe(v)}`,
    );
  }
  return v.includes(a);
}

function strEq(a: string, v: JsonValue, field: string): boolean {
  if (typeof v !== "string") {
    throw new EvaluationError(
      "TYPE_MISMATCH",
      field,
      `Operator "eq" expects string value, got ${describe(v)}`,
    );
  }
  return a === v;
}

function strContains(a: string, v: JsonValue, field: string): boolean {
  if (typeof v !== "string") {
    throw new EvaluationError(
      "TYPE_MISMATCH",
      field,
      `Operator "contains" expects string value, got ${describe(v)}`,
    );
  }
  return a.includes(v);
}

function strIn(a: string, v: JsonValue, field: string): boolean {
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) {
    throw new EvaluationError(
      "TYPE_MISMATCH",
      field,
      `Operator "in" expects array of strings, got ${describe(v)}`,
    );
  }
  return v.includes(a);
}

function assertNeverOperator(op: never, field: string): never {
  throw new EvaluationError("UNSUPPORTED_OPERATOR", field, "Operator not supported: " + String(op));
}

function describe(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}
