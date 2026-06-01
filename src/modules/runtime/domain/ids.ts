export type RuleId = string & { readonly __brand: "RuleId" };
export const ruleId = (raw: string): RuleId => raw as RuleId;
