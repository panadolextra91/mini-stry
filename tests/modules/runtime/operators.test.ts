import { describe, it, expect } from "vitest";
import { evaluateCompare } from "@/modules/runtime/application/operators.js";
import { EvaluationError } from "@/modules/runtime/index.js";
import type { Operator } from "@/modules/runtime/index.js";

describe("evaluateCompare — Number operators", () => {
  const ctx = { x: 10 };

  it("eq", () => {
    expect(evaluateCompare("x", "eq", 10, ctx)).toBe(true);
    expect(evaluateCompare("x", "eq", 5, ctx)).toBe(false);
  });

  it("neq", () => {
    expect(evaluateCompare("x", "neq", 5, ctx)).toBe(true);
    expect(evaluateCompare("x", "neq", 10, ctx)).toBe(false);
  });

  it("gt", () => {
    expect(evaluateCompare("x", "gt", 5, ctx)).toBe(true);
    expect(evaluateCompare("x", "gt", 10, ctx)).toBe(false);
  });

  it("gte", () => {
    expect(evaluateCompare("x", "gte", 10, ctx)).toBe(true);
    expect(evaluateCompare("x", "gte", 15, ctx)).toBe(false);
  });

  it("lt", () => {
    expect(evaluateCompare("x", "lt", 15, ctx)).toBe(true);
    expect(evaluateCompare("x", "lt", 10, ctx)).toBe(false);
  });

  it("lte", () => {
    expect(evaluateCompare("x", "lte", 10, ctx)).toBe(true);
    expect(evaluateCompare("x", "lte", 5, ctx)).toBe(false);
  });

  it("in", () => {
    expect(evaluateCompare("x", "in", [5, 10, 15], ctx)).toBe(true);
    expect(evaluateCompare("x", "in", [1, 2, 3], ctx)).toBe(false);
  });

  it("contains on number throws TYPE_MISMATCH", () => {
    try {
      evaluateCompare("x", "contains", "0", ctx);
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(EvaluationError);
      expect((e as EvaluationError).code).toBe("TYPE_MISMATCH");
    }
  });
});

describe("evaluateCompare — String operators", () => {
  const ctx = { s: "hello world" };

  it("eq", () => {
    expect(evaluateCompare("s", "eq", "hello world", ctx)).toBe(true);
    expect(evaluateCompare("s", "eq", "hello", ctx)).toBe(false);
  });

  it("neq", () => {
    expect(evaluateCompare("s", "neq", "hello", ctx)).toBe(true);
    expect(evaluateCompare("s", "neq", "hello world", ctx)).toBe(false);
  });

  it("contains", () => {
    expect(evaluateCompare("s", "contains", "world", ctx)).toBe(true);
    expect(evaluateCompare("s", "contains", "planet", ctx)).toBe(false);
  });

  it("in", () => {
    expect(evaluateCompare("s", "in", ["hello", "hello world"], ctx)).toBe(true);
    expect(evaluateCompare("s", "in", ["foo", "bar"], ctx)).toBe(false);
  });

  it("gt/gte/lt/lte on string throws TYPE_MISMATCH", () => {
    for (const op of ["gt", "gte", "lt", "lte"] as const) {
      try {
        evaluateCompare("s", op, "a", ctx);
        expect.fail(`should throw on ${op}`);
      } catch (e) {
        expect(e).toBeInstanceOf(EvaluationError);
        expect((e as EvaluationError).code).toBe("TYPE_MISMATCH");
      }
    }
  });
});

describe("evaluateCompare — Coercion rejection", () => {
  it("number field with string value on eq", () => {
    try {
      evaluateCompare("x", "eq", "5", { x: 5 });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(EvaluationError);
      expect((e as EvaluationError).code).toBe("TYPE_MISMATCH");
    }
  });

  it("string field with number value on eq", () => {
    try {
      evaluateCompare("s", "eq", 5, { s: "5" });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(EvaluationError);
      expect((e as EvaluationError).code).toBe("TYPE_MISMATCH");
    }
  });

  it("number field with string value on gt, lt, in", () => {
    for (const op of ["gt", "lt", "in"] as const) {
      try {
        evaluateCompare("x", op, "5", { x: 5 });
        expect.fail(`should throw on ${op}`);
      } catch (e) {
        expect((e as EvaluationError).code).toBe("TYPE_MISMATCH");
      }
    }
  });

  it("string field with number value on contains, in", () => {
    for (const op of ["contains", "in"] as const) {
      try {
        evaluateCompare("s", op, 5, { s: "5" });
        expect.fail(`should throw on ${op}`);
      } catch (e) {
        expect((e as EvaluationError).code).toBe("TYPE_MISMATCH");
      }
    }
  });

  it("boolean field throws unsupported type", () => {
    try {
      evaluateCompare("b", "eq", true, { b: true });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(EvaluationError);
      expect((e as EvaluationError).code).toBe("TYPE_MISMATCH");
    }
  });

  it("array value throws TYPE_MISMATCH with 'array' description", () => {
    try {
      evaluateCompare("x", "eq", [], { x: 5 });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(EvaluationError);
      expect((e as EvaluationError).code).toBe("TYPE_MISMATCH");
      expect((e as Error).message).toContain("got array");
    }
  });

  it("null field throws unsupported type", () => {
    try {
      evaluateCompare("n", "eq", null, { n: null });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(EvaluationError);
      expect((e as EvaluationError).code).toBe("TYPE_MISMATCH");
    }
  });
});

describe("evaluateCompare — Missing field", () => {
  it("throws MISSING_FIELD if key is not in context", () => {
    try {
      evaluateCompare("x", "eq", 1, {});
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(EvaluationError);
      expect((e as EvaluationError).code).toBe("MISSING_FIELD");
    }
  });

  it("does not throw MISSING_FIELD if explicit undefined (falls to TYPE_MISMATCH)", () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      evaluateCompare("x", "eq", 1, { x: undefined } as any);
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(EvaluationError);
      expect((e as EvaluationError).code).toBe("TYPE_MISMATCH");
    }
  });

  it("explicit null does not throw MISSING_FIELD (falls to TYPE_MISMATCH)", () => {
    try {
      evaluateCompare("x", "eq", 1, { x: null });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(EvaluationError);
      expect((e as EvaluationError).code).toBe("TYPE_MISMATCH");
    }
  });
});

describe("evaluateCompare — Unsupported operator (defensive)", () => {
  it("throws UNSUPPORTED_OPERATOR if passed an invalid op", () => {
    try {
      evaluateCompare("x", "matches" as unknown as Operator, "re", { x: "hi" });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(EvaluationError);
      expect((e as EvaluationError).code).toBe("UNSUPPORTED_OPERATOR");
    }
  });

  it("throws UNSUPPORTED_OPERATOR if passed an invalid op for number", () => {
    try {
      evaluateCompare("x", "matches" as unknown as Operator, "re", { x: 1 });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(EvaluationError);
      expect((e as EvaluationError).code).toBe("UNSUPPORTED_OPERATOR");
    }
  });
});
