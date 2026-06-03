import type { UserId, RoleId } from "@/modules/directory/index.js";
import type { ApprovalTaskId } from "../domain/ids.js";

export class RoutingError extends Error {
  constructor(
    public readonly requesterId: UserId | null,
    public readonly targetRoleId: RoleId | null,
    message?: string,
  ) {
    super(
      message ??
        `Could not route approval for requester ${requesterId} targeting role ${targetRoleId}`,
    );
    this.name = "RoutingError";
  }
}

export class HierarchyTraversalError extends Error {
  constructor(message?: string) {
    super(message ?? "Failed to traverse manager reporting lines");
    this.name = "HierarchyTraversalError";
  }
}

export class TaskAlreadyResolvedError extends Error {
  constructor(
    public readonly taskId: ApprovalTaskId,
    message?: string,
  ) {
    super(message ?? `Approval task ${taskId} is already resolved`);
    this.name = "TaskAlreadyResolvedError";
  }
}

export class UnauthorizedApproverError extends Error {
  constructor(message?: string) {
    super(message ?? "Actor is not authorized to approve this task");
    this.name = "UnauthorizedApproverError";
  }
}
