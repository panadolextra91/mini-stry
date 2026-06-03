import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import type { SchemaValidatorPort, ValidationResult } from "../../ports/schema-validator.port.js";
import type { PolicyContent } from "../../domain/policy-content.js";
import { ValidationError } from "../../application/errors.js";
// Bundle the canonical schema artifact (D-23) as a module rather than reading it
// from disk. node:fs/url/path are unavailable in the Convex V8 runtime, so a
// filesystem read here broke `convex codegen`/`dev`/`deploy` for any Convex
// function that instantiates this validator (e.g. convex/request.ts). The JSON
// import inlines the schema at bundle time and works in Node, Vitest, and Convex.
import policyContentSchema from "../../schema/policy-content.schema.json" with { type: "json" };

export class AjvSchemaValidator implements SchemaValidatorPort {
  private readonly validateFn: ValidateFunction;

  constructor() {
    const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
    const schema = policyContentSchema as Record<string, unknown>;
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
