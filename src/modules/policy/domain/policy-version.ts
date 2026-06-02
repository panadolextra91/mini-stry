import type { TenantId, UserId } from "@/modules/directory/index.js";
import type { PolicyId, PolicyVersionId } from "./ids.js";
import type { ValidationError } from "@/modules/runtime/index.js";
import type { PolicyVersionStatus, ValidationStatus } from "./policy-version-status.js";

export interface PolicyVersion {
  readonly id: PolicyVersionId;
  readonly tenantId: TenantId;
  readonly policyId: PolicyId;
  readonly versionNumber: number;
  /**
   * Intentionally `unknown`. The runtime module owns the JSON Schema for content.
   * Do not narrow this type — doing so couples storage to runtime concerns.
   */
  readonly content: unknown;
  readonly status: PolicyVersionStatus;
  readonly validationStatus: ValidationStatus;
  readonly validationErrors: readonly ValidationError[];
  readonly revision: number;
  readonly rollbackFromVersionId: PolicyVersionId | null;
  readonly createdBy: UserId;
  readonly createdAt: number;
  readonly publishedAt: number | null;
}
