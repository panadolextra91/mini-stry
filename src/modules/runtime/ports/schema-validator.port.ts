import type { ValidationError } from "../application/errors.js";
import type { PolicyContent } from "../domain/policy-content.js";

export type ValidationSuccess = {
  readonly ok: true;
  readonly value: PolicyContent;
};

export type ValidationFailure = {
  readonly ok: false;
  readonly errors: readonly ValidationError[];
};

export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * D-22: Error-shape isolation. Ajv types never reach this file.
 */
export interface SchemaValidatorPort {
  validate(content: unknown): ValidationResult;
}
