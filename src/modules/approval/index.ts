// Domain entities
export type { ApprovalChain } from "./domain/approval-chain.js";
export type { ApprovalTask } from "./domain/approval-task.js";

// Domain IDs + factories
export type { ApprovalChainId, ApprovalTaskId } from "./domain/ids.js";
export { approvalChainId, approvalTaskId } from "./domain/ids.js";

// Domain status/state types
export type { ChainStatus } from "./domain/approval-status.js";
export type { TaskState } from "./domain/approval-task-state.js";

// Domain events
export type {
  ApprovalTaskApprovedEvent,
  ApprovalTaskRejectedEvent,
  ApprovalRoutingFailedEvent,
  ApprovalEventMap,
} from "./domain/approval-events.js";

// State machine functions
export {
  transitionTask,
  deriveChainStatus,
  InvalidTaskTransitionError,
} from "./domain/state-machine.js";

// Application errors
export {
  RoutingError,
  HierarchyTraversalError,
  TaskAlreadyResolvedError,
  UnauthorizedApproverError,
} from "./application/errors.js";

// Application services
export { ApprovalRoutingService } from "./application/approval-routing-service.js";
export { ApprovalAuditSubscriber } from "./application/approval-audit-subscriber.js";

// Repository ports
export type {
  CreateApprovalChainInput,
  ApprovalChainRepositoryPort,
} from "./ports/approval-chain-repository.port.js";
export type {
  CreateApprovalTaskInput,
  ApprovalTaskRepositoryPort,
} from "./ports/approval-task-repository.port.js";

// Memory adapters
export { InMemoryApprovalChainRepository } from "./adapters/memory/in-memory-approval-chain-repository.js";
export { InMemoryApprovalTaskRepository } from "./adapters/memory/in-memory-approval-task-repository.js";

// Convex adapters
export { ConvexApprovalChainRepository } from "./adapters/convex/convex-approval-chain-repository.js";
export { ConvexApprovalTaskRepository } from "./adapters/convex/convex-approval-task-repository.js";
export {
  toApprovalChainDomain,
  fromApprovalChainId,
  toApprovalTaskDomain,
  fromApprovalTaskId,
} from "./adapters/convex/mappers.js";

// Re-exports
export { EventDispatcher } from "@/shared/event-dispatcher.js";
