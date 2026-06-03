import { describe, it, expect } from "vitest";
import { evaluate, autoApprove, autoReject, ruleId } from "@/modules/runtime/index.js";
import type { Operator, JsonValue, Decision, Rule } from "@/modules/runtime/index.js";

const r = (
  id: string,
  field: string,
  op: Operator,
  value: JsonValue,
  decision: Decision,
): Rule => ({
  id: ruleId(id),
  when: { type: "compare", field, op, value },
  decision,
});

describe("evaluate — trace correctness", () => {
  it("Trace length === rules examined (rule 2 wins)", () => {
    const policy = {
      rules: [
        r("R1", "x", "eq", 1, autoApprove()),
        r("R2", "x", "eq", 2, autoApprove()),
        r("R3", "x", "eq", 3, autoApprove()),
      ],
      defaultDecision: autoReject(),
    };
    const result = evaluate(policy, { x: 3 });

    expect(result.evaluationTrace.length).toBe(3);
    expect(result.evaluationTrace[0]!.matched).toBe(false);
    expect(result.evaluationTrace[1]!.matched).toBe(false);
    expect(result.evaluationTrace[2]!.matched).toBe(true);
  });

  it("Match-first short-circuit prevents subsequent evaluation", () => {
    const policy = {
      rules: [
        r("R1", "x", "eq", 1, autoApprove()),
        r("R2", "x", "eq", 2, autoApprove()),
        r("R3", "x", "eq", 3, autoApprove()),
      ],
      defaultDecision: autoReject(),
    };
    const result = evaluate(policy, { x: 1 });

    expect(result.evaluationTrace.length).toBe(1);
    expect(result.evaluationTrace[0]!.ruleId).toBe(ruleId("R1"));
    expect(result.evaluationTrace[0]!.matched).toBe(true);

    const r3InTrace = result.evaluationTrace.find((t) => t.ruleId === ruleId("R3"));
    expect(r3InTrace).toBeUndefined();
  });

  it("Trace ruleId order matches rules order when no rules match", () => {
    const policy = {
      rules: [
        r("A", "x", "eq", 1, autoApprove()),
        r("B", "x", "eq", 2, autoApprove()),
        r("C", "x", "eq", 3, autoApprove()),
      ],
      defaultDecision: autoReject(),
    };
    const result = evaluate(policy, { x: 99 });

    expect(result.evaluationTrace.length).toBe(3);
    expect(result.evaluationTrace.map((t) => t.ruleId)).toEqual([
      ruleId("A"),
      ruleId("B"),
      ruleId("C"),
    ]);
  });
});
