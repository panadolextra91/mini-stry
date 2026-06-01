import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { SchemaValidatorPort, ValidationResult } from "../../ports/schema-validator.port.js";
import type { PolicyContent } from "../../domain/policy-content.js";
import { ValidationError } from "../../application/errors.js";

const SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../schema/policy-content.schema.json",
);

export class AjvSchemaValidator implements SchemaValidatorPort {
  private readonly validateFn: ValidateFunction;

  constructor() {
    const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as Record<string, unknown>;
    this.validateFn = ajv.compile(schema);
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
