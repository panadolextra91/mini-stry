export type RequestEvaluationId = string & { readonly __brand: "RequestEvaluationId" };

export const requestEvaluationId = (raw: string): RequestEvaluationId => raw as RequestEvaluationId;
