export type { JsonScalar, JsonValue, EvaluationContext } from "./domain/evaluation-context.js";
export type { Operator, ComparePredicate, Predicate } from "./domain/predicate.js";
export type { RuleId } from "./domain/ids.js";
export { ruleId } from "./domain/ids.js";
export type { Rule } from "./domain/rule.js";
export type { PolicyContent } from "./domain/policy-content.js";
export type { Decision } from "./domain/decision.js";
export { autoApprove, autoReject, requestApproval } from "./domain/decision.js";
export type { TraceEntry, EvaluationResult } from "./domain/evaluation-result.js";

export type { SchemaValidatorPort, ValidationResult, ValidationSuccess, ValidationFailure } from "./ports/schema-validator.port.js";
export { ValidationError, EvaluationError, PolicySchemaInvalidError } from "./application/errors.js";
export type { EvaluationErrorCode } from "./application/errors.js";
export { AjvSchemaValidator } from "./adapters/ajv/ajv-schema-validator.js";

export { evaluate } from "./application/evaluator.js";
export { validateAndEvaluate } from "./application/policy-runtime.js";
