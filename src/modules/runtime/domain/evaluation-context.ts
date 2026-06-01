/**
 * CTX-01, CTX-02, D-27: Flat lookup; no nested path parsing; caller flattens domain payloads.
 */
export type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | JsonScalar[];
export type EvaluationContext = Record<string, JsonValue>;
