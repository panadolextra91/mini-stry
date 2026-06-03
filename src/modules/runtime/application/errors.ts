export class ValidationError extends Error {
  constructor(
    public readonly code: string,
    public readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export type EvaluationErrorCode = "MISSING_FIELD" | "TYPE_MISMATCH" | "UNSUPPORTED_OPERATOR";

export class EvaluationError extends Error {
  constructor(
    public readonly code: EvaluationErrorCode,
    public readonly field: string | null,
    message: string,
  ) {
    super(message);
    this.name = "EvaluationError";
  }
}

export class PolicySchemaInvalidError extends Error {
  readonly code = "POLICY_SCHEMA_INVALID" as const;
  constructor(public readonly errors: readonly ValidationError[]) {
    super(`Policy schema validation failed with ${errors.length} error(s)`);
    this.name = "PolicySchemaInvalidError";
  }
}
