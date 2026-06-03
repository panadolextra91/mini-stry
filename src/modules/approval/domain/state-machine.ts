import type { TaskState } from "./approval-task-state.js";
import type { ChainStatus } from "./approval-status.js";

export class InvalidTaskTransitionError extends Error {
  constructor(public readonly state: string, public readonly action: string) {
    super(`Cannot transition task in state "${state}" with action "${action}"`);
    this.name = "InvalidTaskTransitionError";
  }
}

export function transitionTask(state: TaskState, action: "APPROVE" | "REJECT"): TaskState {
  if (state !== "PENDING") {
    throw new InvalidTaskTransitionError(state, action);
  }
  return action === "APPROVE" ? "APPROVED" : "REJECTED";
}

export function deriveChainStatus(taskStates: readonly TaskState[]): ChainStatus {
  if (taskStates.length === 0) {
    return "IN_PROGRESS";
  }
  if (taskStates.includes("REJECTED")) {
    return "REJECTED";
  }
  if (taskStates.every((s) => s === "APPROVED")) {
    return "APPROVED";
  }
  return "IN_PROGRESS";
}
