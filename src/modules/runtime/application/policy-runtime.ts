import type { SchemaValidatorPort } from "../ports/schema-validator.port.js";
import type { EvaluationContext } from "../domain/evaluation-context.js";
import type { EvaluationResult } from "../domain/evaluation-result.js";
import { evaluate } from "./evaluator.js";
import { PolicySchemaInvalidError } from "./errors.js";

/**
 * Composes the Phase 2 runtime: validator (RUN-03) → evaluator (RUN-02) → Decision (DEC-02).
 *
 * The evaluator MUST NOT run on an invalid policy. This function enforces that contract
 * by throwing PolicySchemaInvalidError BEFORE delegating to evaluate(). RUN-03's hardest
 * invariant lives here.
 *
 * REFINEMENT: schema validation is the type guard. The discriminated `ValidationResult`
 * narrows `content: unknown` to `result.value: PolicyContent` on the success branch — no
 * cast at this call site. The single runtime-to-type-system cast lives inside
 * AjvSchemaValidator (plan 02-01 Task 4).
 *
 * Phase 4 PolicyRuntimeService wraps this with TenantContext + persistence + audit.
 */
export function validateAndEvaluate(
  validator: SchemaValidatorPort,
  content: unknown,
  ctx: EvaluationContext,
): EvaluationResult {
  const result = validator.validate(content);
  if (!result.ok) {
    throw new PolicySchemaInvalidError(result.errors);
  }
  // result is narrowed to ValidationSuccess here; result.value is PolicyContent.
  return evaluate(result.value, ctx);
}
