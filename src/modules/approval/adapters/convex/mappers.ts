import {
  approvalChainId as buildApprovalChainId,
  approvalTaskId as buildApprovalTaskId,
  type ApprovalChainId,
  type ApprovalTaskId,
} from "../../domain/ids.js";
import type { ApprovalChain } from "../../domain/approval-chain.js";
import type { ApprovalTask } from "../../domain/approval-task.js";
import type { ChainStatus } from "../../domain/approval-status.js";
import type { TaskState } from "../../domain/approval-task-state.js";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel.js";
import { toTenantId, toUserId, toRoleId } from "@/modules/directory/adapters/convex/mappers.js";
import { toRequestEvaluationId } from "@/modules/request/adapters/convex/mappers.js";

// ID Mappers for ApprovalChain
export const toApprovalChainId = (raw: Id<"approvalChains">): ApprovalChainId =>
  buildApprovalChainId(raw);
export const fromApprovalChainId = (brand: ApprovalChainId): Id<"approvalChains"> =>
  brand as string as Id<"approvalChains">;

// ID Mappers for ApprovalTask
export const toApprovalTaskId = (raw: Id<"approvalTasks">): ApprovalTaskId =>
  buildApprovalTaskId(raw);
export const fromApprovalTaskId = (brand: ApprovalTaskId): Id<"approvalTasks"> =>
  brand as string as Id<"approvalTasks">;

// Entity Mapper for ApprovalChain
export const toApprovalChainDomain = (doc: Doc<"approvalChains">): ApprovalChain => ({
  id: toApprovalChainId(doc._id),
  tenantId: toTenantId(doc.tenantId),
  requestEvaluationId: toRequestEvaluationId(doc.requestEvaluationId),
  status: doc.status as ChainStatus,
  createdAt: doc.createdAt,
});

// Entity Mapper for ApprovalTask
export const toApprovalTaskDomain = (doc: Doc<"approvalTasks">): ApprovalTask => ({
  id: toApprovalTaskId(doc._id),
  tenantId: toTenantId(doc.tenantId),
  chainId: toApprovalChainId(doc.chainId),
  stageNumber: doc.stageNumber,
  approverId: toUserId(doc.approverId as Id<"users">),
  approverRoleId: toRoleId(doc.approverRoleId as Id<"roles">),
  state: doc.state as TaskState,
  createdAt: doc.createdAt,
});
