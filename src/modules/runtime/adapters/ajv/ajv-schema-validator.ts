import type { ErrorObject, ValidateFunction } from "ajv/dist/2020.js";
import type { SchemaValidatorPort, ValidationResult } from "../../ports/schema-validator.port.js";
import type { PolicyContent } from "../../domain/policy-content.js";
import { ValidationError } from "../../application/errors.js";
import validatePolicy from "./compiled-schema.js";

export class AjvSchemaValidator implements SchemaValidatorPort {
  private readonly validateFn: ValidateFunction;

  constructor() {
    this.validateFn = validatePolicy as unknown as ValidateFunction;
  }

  validate(content: unknown): ValidationResult {
    if (this.validateFn(content)) {
      // REFINEMENT: schema validation is the type guard. The cast is localized to this
      // adapter — the ONLY place runtime proof crosses into the type system. Downstream
      // consumers receive `result.value: PolicyContent` and never need their own cast.
      return { ok: true, value: content as PolicyContent };
    }
    const errs = this.validateFn.errors as ErrorObject[];
    return { ok: false, errors: errs.map(toDomainError) };
  }
}

function toDomainError(e: ErrorObject): ValidationError {
  const code = String(e.keyword);
  const path = e.instancePath === "" ? "/" : e.instancePath;
  const msg = e.message as string;
  return new ValidationError(code, path, msg);
}
