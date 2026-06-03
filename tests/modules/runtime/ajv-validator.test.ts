import { describe, it, expect, expectTypeOf } from "vitest";
import {
  AjvSchemaValidator,
  ValidationError,
  type PolicyContent,
  autoApprove,
} from "@/modules/runtime/index.js";

describe("AjvSchemaValidator", () => {
  it("constructs without throwing (compiles schema)", () => {
    expect(() => new AjvSchemaValidator()).not.toThrow();
  });

  it("reuses compiled validator across calls (sanity check)", () => {
    const v = new AjvSchemaValidator();
    const valid = { rules: [], defaultDecision: autoApprove() };
    const r1 = v.validate(valid);
    const r2 = v.validate(valid);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
  });

  it("success branch carries typed value by reference", () => {
    const v = new AjvSchemaValidator();
    const validFixture = { rules: [], defaultDecision: autoApprove() };
    const r = v.validate(validFixture);

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe(validFixture);
      expectTypeOf(r.value).toEqualTypeOf<PolicyContent>();
    }
  });

  it("failure branch has no value and returns ValidationError instances", () => {
    const v = new AjvSchemaValidator();
    const invalidFixture = { rules: [], defaultDecision: { kind: "unknown" } };
    const r = v.validate(invalidFixture);

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect("value" in r).toBe(false);
      expect(r.errors.length).toBeGreaterThan(0);

      for (const e of r.errors) {
        expect(e).toBeInstanceOf(ValidationError);
        expect(typeof e.code).toBe("string");
        expect(typeof e.path).toBe("string");
        expect(typeof e.message).toBe("string");
        expect("keyword" in e).toBe(false);
      }
    }
  });
});
