import type { PolicyId, PolicyVersionId } from "./ids.js";
import type { TenantId, UserId } from "@/modules/directory/index.js";

export interface DraftCreatedEvent {
  readonly tenantId: TenantId;
  readonly policyId: PolicyId;
  readonly policyVersionId: PolicyVersionId;
  readonly versionNumber: number;
  readonly actorId: UserId;
  readonly rollbackFromVersionId: PolicyVersionId | null;
  readonly timestamp: number;
}

export interface DraftUpdatedEvent {
  readonly tenantId: TenantId;
  readonly policyId: PolicyId;
  readonly policyVersionId: PolicyVersionId;
  readonly versionNumber: number;
  readonly actorId: UserId;
  readonly timestamp: number;
}

export interface PolicyPublishedEvent {
  readonly tenantId: TenantId;
  readonly policyId: PolicyId;
  readonly policyVersionId: PolicyVersionId;
  readonly versionNumber: number;
  readonly actorId: UserId;
  readonly timestamp: number;
}

// No PolicyRolledBackEvent — rollback is modeled as DraftCreated
// with rollbackFromVersionId != null, followed by PolicyPublished.
// Audit subscribers infer rollback from rollbackFromVersionId.

export type PolicyEventMap = {
  DraftCreated: DraftCreatedEvent;
  DraftUpdated: DraftUpdatedEvent;
  PolicyPublished: PolicyPublishedEvent;
};
