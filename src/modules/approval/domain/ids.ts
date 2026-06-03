export type ApprovalChainId = string & { readonly __brand: "ApprovalChainId" };
export type ApprovalTaskId = string & { readonly __brand: "ApprovalTaskId" };

export const approvalChainId = (raw: string): ApprovalChainId => raw as ApprovalChainId;
export const approvalTaskId = (raw: string): ApprovalTaskId => raw as ApprovalTaskId;
