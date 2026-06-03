import type { PolicyId, PolicyVersionId } from "../domain/ids.js";
import type { PolicyVersion } from "../domain/policy-version.js";
import type { PolicyVersionStatus, ValidationStatus } from "../domain/policy-version-status.js";
import type { TenantContext, UserId } from "@/modules/directory/index.js";
import type { ValidationError } from "@/modules/runtime/index.js";

export interface CreateDraftInput {
  readonly policyId: PolicyId;
  readonly content: unknown;
  readonly createdBy: UserId;
  readonly rollbackFromVersionId: PolicyVersionId | null;
  readonly versionNumber: number;
  readonly validationStatus: ValidationStatus;
  readonly validationErrors: readonly ValidationError[];
}

export interface UpdateDraftPatch {
  readonly content?: unknown;
  readonly validationStatus?: ValidationStatus;
  readonly validationErrors?: readonly ValidationError[];
  readonly revision: number;
  readonly publishedAt?: number;
  readonly status?: PolicyVersionStatus;
}

export interface PolicyVersionRepositoryPort {
  create(ctx: TenantContext, input: CreateDraftInput): Promise<PolicyVersion>;
  findById(ctx: TenantContext, id: PolicyVersionId): Promise<PolicyVersion | null>;
  findDraftByPolicy(ctx: TenantContext, policyId: PolicyId): Promise<PolicyVersion | null>;
  update(ctx: TenantContext, id: PolicyVersionId, patch: UpdateDraftPatch): Promise<PolicyVersion>;
  /**
   * Returns the next available version number for a policy.
   *
   * **MVP note:** The current design (query max + 1) is acceptable for MVP and
   * in-memory repositories. Future production implementations must allocate
   * version numbers atomically within a single persistence transaction to
   * prevent race conditions under concurrent writes.
   */
  getNextVersionNumber(ctx: TenantContext, policyId: PolicyId): Promise<number>;
}
