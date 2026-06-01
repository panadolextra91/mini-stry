import { describe, it, expect } from "vitest";
import { evaluate, autoApprove, autoReject, requestApproval, ruleId } from "@/modules/runtime/index.js";
import { roleId } from "@/modules/directory/index.js";
import type { Operator, JsonValue, Decision, Rule } from "@/modules/runtime/index.js";

const r = (id: string, field: string, op: Operator, value: JsonValue, decision: Decision): Rule => ({
  id: ruleId(id),
  when: { type: "compare", field, op, value },
  decision,
});

describe("evaluate — match-first semantics", () => {
  it("rule[0] wins", () => {
    const policy = {
      rules: [r("R1", "x", "gt", 5, autoApprove())],
      defaultDecision: autoReject(),
    };
    const result = evaluate(policy, { x: 10 });
    
    expect(result.decision.kind).toBe("auto-approve");
    expect(result.matchedRuleId).toBe(ruleId("R1"));
    expect(result.evaluationTrace.length).toBe(1);
    expect(result.evaluationTrace[0]!.matched).toBe(true);
  });

  it("rule[1] wins after rule[0] mismatches", () => {
    const policy = {
      rules: [
        r("R1", "x", "gt", 100, autoApprove()),
        r("R2", "x", "gt", 5, autoReject()),
      ],
      defaultDecision: autoApprove(),
    };
    const result = evaluate(policy, { x: 10 });
    
    expect(result.decision.kind).toBe("auto-reject");
    expect(result.matchedRuleId).toBe(ruleId("R2"));
    expect(result.evaluationTrace.length).toBe(2);
    expect(result.evaluationTrace[0]!.matched).toBe(false);
    expect(result.evaluationTrace[1]!.matched).toBe(true);
  });

  it("no rule matches -> defaultDecision", () => {
    const policy = {
      rules: [
        r("R1", "x", "gt", 100, autoApprove()),
        r("R2", "x", "gt", 50, autoApprove()),
      ],
      defaultDecision: requestApproval(roleId("ROLE-OPS")),
    };
    const result = evaluate(policy, { x: 10 });
    
    expect(result.decision.kind).toBe("request-approval");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.decision as any).targetRoleId).toBe("ROLE-OPS");
    expect(result.matchedRuleId).toBeNull();
    expect(result.evaluationTrace.length).toBe(2);
    expect(result.evaluationTrace[0]!.matched).toBe(false);
    expect(result.evaluationTrace[1]!.matched).toBe(false);
  });

  it("empty rules -> defaultDecision immediately", () => {
    const policy = {
      rules: [],
      defaultDecision: autoReject(),
    };
    const result = evaluate(policy, {});
    
    expect(result.decision.kind).toBe("auto-reject");
    expect(result.matchedRuleId).toBeNull();
    expect(result.evaluationTrace.length).toBe(0);
  });
});
