import { describe, it, expect } from "vitest";
import {
  validateAndEvaluate,
  AjvSchemaValidator,
  PolicySchemaInvalidError,
  ValidationError,
  EvaluationError,
  autoApprove,
  autoReject,
  ruleId,
} from "@/modules/runtime/index.js";
import type { SchemaValidatorPort, PolicyContent } from "@/modules/runtime/index.js";

describe("validateAndEvaluate composer", () => {
  it("Valid policy → returns EvaluationResult unchanged from evaluate()", () => {
    const policy = {
      rules: [
        {
          id: ruleId("R1"),
          when: { type: "compare" as const, field: "x", op: "gt" as const, value: 5 },
          decision: autoApprove(),
        },
      ],
      defaultDecision: autoReject(),
    };
    const result = validateAndEvaluate(new AjvSchemaValidator(), policy, { x: 10 });
    expect(result.decision.kind).toBe("auto-approve");
    expect(result.matchedRuleId).toBe(ruleId("R1"));
    expect(result.evaluationTrace.length).toBe(1);
  });

  it("Invalid policy (missing defaultDecision) → throws PolicySchemaInvalidError BEFORE evaluator runs", () => {
    const policy = { rules: [] }; // no defaultDecision
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let caught: any = null;
    try {
      validateAndEvaluate(new AjvSchemaValidator(), policy, {});
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PolicySchemaInvalidError);
    expect(caught.code).toBe("POLICY_SCHEMA_INVALID");
    expect(caught.errors.length).toBeGreaterThan(0);
    expect(caught.errors[0]).toBeInstanceOf(ValidationError);
  });

  it("Invalid policy (unknown operator) → throws PolicySchemaInvalidError", () => {
    const policy = {
      rules: [
        {
          id: ruleId("R1"),
          when: { type: "compare", field: "x", op: "matches", value: 5 },
          decision: autoApprove(),
        },
      ],
      defaultDecision: autoReject(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let caught: any = null;
    try {
      validateAndEvaluate(new AjvSchemaValidator(), policy, {});
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PolicySchemaInvalidError);
    const hasEnumError = caught.errors.some(
      (e: ValidationError) => e.code === "enum" || e.code === "oneOf" || e.code === "anyOf",
    );
    expect(hasEnumError).toBe(true);
  });

  it("Validator port respected (failure path)", () => {
    const fakeValidator: SchemaValidatorPort = {
      validate: () => ({
        ok: false,
        errors: [new ValidationError("custom", "/test", "forced failure")],
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let caught: any = null;
    try {
      validateAndEvaluate(fakeValidator, {}, {});
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PolicySchemaInvalidError);
    expect(caught.errors[0].message).toBe("forced failure");
  });

  it("REFINEMENT — Validator port carries typed value through success branch", () => {
    const substitutePolicy: PolicyContent = {
      rules: [
        {
          id: ruleId("S1"),
          when: { type: "compare", field: "y", op: "eq", value: 1 },
          decision: autoApprove(),
        },
      ],
      defaultDecision: autoReject(),
    };
    const fakeValidator: SchemaValidatorPort = {
      validate: () => ({ ok: true, value: substitutePolicy }),
    };
    // Pass completely invalid input
    const result = validateAndEvaluate(fakeValidator, "completely invalid", { y: 1 });
    // Evaluates against the substitute policy, not the input!
    expect(result.matchedRuleId).toBe(ruleId("S1"));
    expect(result.decision.kind).toBe("auto-approve");
  });

  it("Evaluator errors propagate after schema validation passes", () => {
    const policy = {
      rules: [
        {
          id: ruleId("R1"),
          when: { type: "compare" as const, field: "missing", op: "eq" as const, value: 5 },
          decision: autoApprove(),
        },
      ],
      defaultDecision: autoReject(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let caught: any = null;
    try {
      validateAndEvaluate(new AjvSchemaValidator(), policy, {});
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EvaluationError);
    expect(caught.code).toBe("MISSING_FIELD");
  });
});
