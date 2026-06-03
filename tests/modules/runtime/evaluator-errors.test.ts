import { describe, it, expect } from "vitest";
import {
  evaluate,
  EvaluationError,
  autoApprove,
  autoReject,
  ruleId,
} from "@/modules/runtime/index.js";
import type { Operator, JsonValue, Decision, Rule, Predicate } from "@/modules/runtime/index.js";

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

describe("evaluate — fail-fast error paths", () => {
  it("MISSING_FIELD on first rule does not fall through", () => {
    const policy = {
      rules: [r("R1", "x", "eq", 5, autoApprove())],
      defaultDecision: autoReject(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let caughtError: any = null;
    try {
      evaluate(policy, {});
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(EvaluationError);
    expect(caughtError.code).toBe("MISSING_FIELD");
  });

  it("TYPE_MISMATCH on first rule", () => {
    const policy = {
      rules: [r("R1", "x", "gt", 5, autoApprove())],
      defaultDecision: autoReject(),
    };

    try {
      evaluate(policy, { x: "hello" });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(EvaluationError);
      expect((e as EvaluationError).code).toBe("TYPE_MISMATCH");
    }
  });

  it("UNSUPPORTED_OPERATOR via cast", () => {
    const policy = {
      rules: [
        {
          id: ruleId("R1"),
          when: { type: "compare", field: "x", op: "invalid" as Operator, value: 5 } as Predicate,
          decision: autoApprove(),
        },
      ],
      defaultDecision: autoReject(),
    };

    try {
      evaluate(policy, { x: 5 });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(EvaluationError);
      expect((e as EvaluationError).code).toBe("UNSUPPORTED_OPERATOR");
    }
  });

  it("UNSUPPORTED_PREDICATE type via cast", () => {
    const policy = {
      rules: [
        {
          id: ruleId("R1"),
          when: { type: "and", predicates: [] } as unknown as Predicate,
          decision: autoApprove(),
        },
      ],
      defaultDecision: autoReject(),
    };

    try {
      evaluate(policy, {});
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(EvaluationError);
      expect((e as EvaluationError).code).toBe("UNSUPPORTED_OPERATOR");
    }
  });

  it("UNSUPPORTED_PREDICATE missing type", () => {
    const policy = {
      rules: [
        {
          id: ruleId("R1"),
          when: {} as Predicate,
          decision: autoApprove(),
        },
      ],
      defaultDecision: autoReject(),
    };

    try {
      evaluate(policy, {});
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(EvaluationError);
      expect((e as EvaluationError).code).toBe("UNSUPPORTED_OPERATOR");
    }
  });
});
