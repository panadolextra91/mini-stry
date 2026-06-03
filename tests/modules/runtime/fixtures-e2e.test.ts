import { describe, it, expect } from "vitest";
import {
  validateAndEvaluate,
  AjvSchemaValidator,
  autoApprove,
  autoReject,
  requestApproval,
  ruleId,
} from "@/modules/runtime/index.js";
import { roleId } from "@/modules/directory/index.js";

describe("End-to-End Fixtures: validateAndEvaluate pipeline", () => {
  const validator = new AjvSchemaValidator();

  describe("Fixture A: Small numeric leave-days policy", () => {
    const policy = {
      rules: [
        {
          id: ruleId("A1"),
          when: { type: "compare" as const, field: "leave_days", op: "lte" as const, value: 2 },
          decision: autoApprove(),
        },
        {
          id: ruleId("A2"),
          when: { type: "compare" as const, field: "leave_days", op: "gt" as const, value: 14 },
          decision: autoReject(),
        },
      ],
      defaultDecision: requestApproval(roleId("ROLE-MANAGER")),
    };

    it.each([
      { leave_days: 1, expectedKind: "auto-approve", expectedRule: "A1", expectedTrace: 1 },
      { leave_days: 15, expectedKind: "auto-reject", expectedRule: "A2", expectedTrace: 2 },
      {
        leave_days: 5,
        expectedKind: "request-approval",
        expectedRule: null,
        expectedTrace: 2,
        expectedRole: "ROLE-MANAGER",
      },
    ])(
      "leave_days=$leave_days -> $expectedKind",
      ({ leave_days, expectedKind, expectedRule, expectedTrace, expectedRole }) => {
        const result = validateAndEvaluate(validator, policy, { leave_days });
        expect(result.decision.kind).toBe(expectedKind);
        expect(result.matchedRuleId).toBe(expectedRule ? ruleId(expectedRule) : null);
        expect(result.evaluationTrace.length).toBe(expectedTrace);

        if (expectedKind === "request-approval") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          expect((result.decision as any).targetRoleId).toBe(expectedRole);
        }
      },
    );
  });

  describe("Fixture B: String role-based policy", () => {
    const policy = {
      rules: [
        {
          id: ruleId("B1"),
          when: {
            type: "compare" as const,
            field: "requester_role",
            op: "eq" as const,
            value: "admin",
          },
          decision: autoApprove(),
        },
        {
          id: ruleId("B2"),
          when: {
            type: "compare" as const,
            field: "requester_role",
            op: "in" as const,
            value: ["intern", "contractor"],
          },
          decision: autoReject(),
        },
      ],
      defaultDecision: requestApproval(roleId("ROLE-DIRECTOR")),
    };

    it.each([
      {
        requester_role: "admin",
        expectedKind: "auto-approve",
        expectedRule: "B1",
        expectedTrace: 1,
      },
      {
        requester_role: "intern",
        expectedKind: "auto-reject",
        expectedRule: "B2",
        expectedTrace: 2,
      },
      {
        requester_role: "manager",
        expectedKind: "request-approval",
        expectedRule: null,
        expectedTrace: 2,
        expectedRole: "ROLE-DIRECTOR",
      },
    ])(
      "role=$requester_role -> $expectedKind",
      ({ requester_role, expectedKind, expectedRule, expectedTrace, expectedRole }) => {
        const result = validateAndEvaluate(validator, policy, { requester_role });
        expect(result.decision.kind).toBe(expectedKind);
        expect(result.matchedRuleId).toBe(expectedRule ? ruleId(expectedRule) : null);
        expect(result.evaluationTrace.length).toBe(expectedTrace);

        if (expectedKind === "request-approval") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          expect((result.decision as any).targetRoleId).toBe(expectedRole);
        }
      },
    );
  });

  describe("Fixture C: Empty rule list", () => {
    const policy = {
      rules: [],
      defaultDecision: autoApprove(),
    };

    it("falls through to default immediately", () => {
      const result = validateAndEvaluate(validator, policy, {});
      expect(result.decision.kind).toBe("auto-approve");
      expect(result.matchedRuleId).toBeNull();
      expect(result.evaluationTrace.length).toBe(0);
    });
  });
});
