import { describe, it, expect } from "vitest";
import { AjvSchemaValidator } from "@/modules/runtime/index.js";

describe("AjvSchemaValidator - invalid schemas", () => {
  const validator = new AjvSchemaValidator();

  function expectInvalid(fixture: unknown, keyword: string) {
    const r = validator.validate(fixture);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.length).toBeGreaterThan(0);
      const hasKeyword = r.errors.some((e) => e.code === keyword);
      expect(hasKeyword).toBe(true);
    }
  }

  it("Missing rules field", () => {
    expectInvalid({ defaultDecision: { kind: "auto-approve" } }, "required");
  });

  it("Missing defaultDecision field", () => {
    expectInvalid({ rules: [] }, "required");
  });

  it("Unknown top-level property", () => {
    expectInvalid({ rules: [], defaultDecision: { kind: "auto-approve" }, foo: "bar" }, "additionalProperties");
  });

  it("Unknown predicate type value", () => {
    expectInvalid({
      rules: [
        {
          id: "r1",
          when: { type: "and", field: "f", op: "eq", value: 1 },
          decision: { kind: "auto-approve" }
        }
      ],
      defaultDecision: { kind: "auto-approve" }
    }, "const");
  });

  it("contains operator on a numeric value", () => {
    expectInvalid({
      rules: [
        {
          id: "r1",
          when: { type: "compare", field: "f", op: "contains", value: 123 },
          decision: { kind: "auto-approve" }
        }
      ],
      defaultDecision: { kind: "auto-approve" }
    }, "type");
  });

  it("gt operator on a string value", () => {
    expectInvalid({
      rules: [
        {
          id: "r1",
          when: { type: "compare", field: "f", op: "gt", value: "100" },
          decision: { kind: "auto-approve" }
        }
      ],
      defaultDecision: { kind: "auto-approve" }
    }, "type");
  });

  it("in operator with scalar value", () => {
    expectInvalid({
      rules: [
        {
          id: "r1",
          when: { type: "compare", field: "f", op: "in", value: "scalar" },
          decision: { kind: "auto-approve" }
        }
      ],
      defaultDecision: { kind: "auto-approve" }
    }, "type");
  });

  it("request-approval Decision without targetRoleId", () => {
    expectInvalid({
      rules: [],
      defaultDecision: { kind: "request-approval" }
    }, "required");
  });

  it("Decision with unknown kind", () => {
    expectInvalid({
      rules: [],
      defaultDecision: { kind: "escalate" }
    }, "const");
  });

  it("Rule with missing id", () => {
    expectInvalid({
      rules: [
        {
          when: { type: "compare", field: "f", op: "eq", value: 1 },
          decision: { kind: "auto-approve" }
        }
      ],
      defaultDecision: { kind: "auto-approve" }
    }, "required");
  });

  it("Operator outside enum", () => {
    expectInvalid({
      rules: [
        {
          id: "r1",
          when: { type: "compare", field: "f", op: "matches", value: "re" },
          decision: { kind: "auto-approve" }
        }
      ],
      defaultDecision: { kind: "auto-approve" }
    }, "enum");
  });
});
