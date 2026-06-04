import { describe, it, expect } from "vitest";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  AjvSchemaValidator,
  policyContentSchema,
  autoApprove,
  autoReject,
  ruleId,
} from "@/modules/runtime/index.js";

describe("policyContentSchema - canonical parity", () => {
  const customAjv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  const customValidate = customAjv.compile(policyContentSchema as Record<string, unknown>);
  const systemValidator = new AjvSchemaValidator();

  it("exports the single canonical schema artifact", () => {
    // Assert D-59 invariant: $id must match the canonical schema URI
    expect((policyContentSchema as Record<string, unknown>).$id).toBe("https://mini-stry.local/schema/policy-content.json");
  });

  it("accepts valid schema fixtures (parity test)", () => {
    const fixture1 = {
      rules: [],
      defaultDecision: autoApprove(),
    };
    
    const fixture2 = {
      rules: [
        {
          id: ruleId("rule-1"),
          when: { type: "compare", field: "amount", op: "eq", value: 100 },
          decision: autoApprove(),
        },
      ],
      defaultDecision: autoReject(),
    };

    // Both the custom compiler (using the exported schema) and the system validator should accept
    expect(customValidate(fixture1)).toBe(true);
    expect(systemValidator.validate(fixture1).ok).toBe(true);

    expect(customValidate(fixture2)).toBe(true);
    expect(systemValidator.validate(fixture2).ok).toBe(true);
  });

  it("rejects invalid schema fixtures (parity test)", () => {
    const fixture1 = { defaultDecision: { kind: "auto-approve" } }; // Missing rules
    const fixture2 = { rules: [], defaultDecision: { kind: "escalate" } }; // Invalid decision kind

    expect(customValidate(fixture1)).toBe(false);
    expect(systemValidator.validate(fixture1).ok).toBe(false);

    expect(customValidate(fixture2)).toBe(false);
    expect(systemValidator.validate(fixture2).ok).toBe(false);
  });
});
