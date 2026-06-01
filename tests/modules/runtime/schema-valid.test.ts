import { describe, it, expect } from "vitest";
import { AjvSchemaValidator, autoApprove, autoReject, requestApproval, ruleId } from "@/modules/runtime/index.js";

describe("AjvSchemaValidator - valid schemas", () => {
  it("Smallest valid policy: empty rules array + an auto-approve defaultDecision", () => {
    const fixture = {
      rules: [],
      defaultDecision: autoApprove(),
    };
    const r = new AjvSchemaValidator().validate(fixture);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe(fixture);
      expect(r.value.rules).toBeDefined();
      expect(r.value.defaultDecision.kind).toMatch(/^(auto-approve|auto-reject|request-approval)$/);
    }
  });

  it("Single auto-approve rule on a numeric eq predicate", () => {
    const fixture = {
      rules: [
        {
          id: ruleId("rule-1"),
          when: { type: "compare", field: "amount", op: "eq", value: 100 },
          decision: autoApprove(),
        },
      ],
      defaultDecision: autoReject(),
    };
    const r = new AjvSchemaValidator().validate(fixture);
    expect(r.ok).toBe(true);
  });

  it("Single auto-reject rule on a string contains predicate", () => {
    const fixture = {
      rules: [
        {
          id: ruleId("rule-2"),
          when: { type: "compare", field: "status", op: "contains", value: "fail" },
          decision: autoReject(),
        },
      ],
      defaultDecision: autoApprove(),
    };
    const r = new AjvSchemaValidator().validate(fixture);
    expect(r.ok).toBe(true);
  });

  it("request-approval rule with a real-looking RoleId string", () => {
    // Note: RoleId is imported from @/modules/directory but we can cast a string for test fixture
    const fixture = {
      rules: [
        {
          id: ruleId("rule-3"),
          when: { type: "compare", field: "department", op: "eq", value: "IT" },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          decision: requestApproval("role-it-manager" as any),
        },
      ],
      defaultDecision: autoReject(),
    };
    const r = new AjvSchemaValidator().validate(fixture);
    expect(r.ok).toBe(true);
  });

  it("Numeric gt with value: 10", () => {
    const fixture = {
      rules: [
        {
          id: ruleId("rule-4"),
          when: { type: "compare", field: "count", op: "gt", value: 10 },
          decision: autoApprove(),
        },
      ],
      defaultDecision: autoReject(),
    };
    const r = new AjvSchemaValidator().validate(fixture);
    expect(r.ok).toBe(true);
  });

  it("in operator with value: ['alice','bob']", () => {
    const fixture = {
      rules: [
        {
          id: ruleId("rule-5"),
          when: { type: "compare", field: "user", op: "in", value: ["alice", "bob"] },
          decision: autoApprove(),
        },
      ],
      defaultDecision: autoReject(),
    };
    const r = new AjvSchemaValidator().validate(fixture);
    expect(r.ok).toBe(true);
  });
});
