export type PolicyId = string & { readonly __brand: "PolicyId" };
export type PolicyVersionId = string & { readonly __brand: "PolicyVersionId" };

export const policyId = (raw: string): PolicyId => raw as PolicyId;
export const policyVersionId = (raw: string): PolicyVersionId => raw as PolicyVersionId;
