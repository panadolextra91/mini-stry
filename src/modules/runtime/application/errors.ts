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

export type EvaluationErrorCode =
  | "MISSING_FIELD"
  | "TYPE_MISMATCH"
  | "UNSUPPORTED_OPERATOR";

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
