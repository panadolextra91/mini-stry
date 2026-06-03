import {
  policyId as buildPolicyId,
  policyVersionId as buildPolicyVersionId,
  type PolicyId,
  type PolicyVersionId,
} from "../../domain/ids.js";
import type { Policy } from "../../domain/policy.js";
import type { PolicyVersion } from "../../domain/policy-version.js";
import type { PolicyVersionStatus, ValidationStatus } from "../../domain/policy-version-status.js";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel.js";
import { toTenantId } from "@/modules/directory/adapters/convex/mappers.js";
import { ValidationError } from "@/modules/runtime/index.js";
import { userId as buildUserId } from "@/modules/directory/index.js";

// ID Mappers
export const toPolicyId = (raw: Id<"policies">): PolicyId => buildPolicyId(raw);
export const fromPolicyId = (brand: PolicyId): Id<"policies"> => brand as string as Id<"policies">;

export const toPolicyVersionId = (raw: Id<"policyVersions">): PolicyVersionId =>
  buildPolicyVersionId(raw);
export const fromPolicyVersionId = (brand: PolicyVersionId): Id<"policyVersions"> =>
  brand as string as Id<"policyVersions">;

// Entity Mappers
export const toPolicyDomain = (doc: Doc<"policies">): Policy => ({
  id: toPolicyId(doc._id),
  tenantId: toTenantId(doc.tenantId),
  name: doc.name,
  requestType: doc.requestType,
  activeVersionId: doc.activeVersionId ? toPolicyVersionId(doc.activeVersionId) : null,
  createdAt: doc.createdAt,
});

export const toPolicyVersionDomain = (doc: Doc<"policyVersions">): PolicyVersion => ({
  id: toPolicyVersionId(doc._id),
  tenantId: toTenantId(doc.tenantId),
  policyId: toPolicyId(doc.policyId),
  versionNumber: doc.versionNumber,
  content: doc.content,
  status: doc.status as PolicyVersionStatus,
  validationStatus: doc.validationStatus as ValidationStatus,
  validationErrors: doc.validationErrors.map(
    (e: { code: string; path: string; message: string }) =>
      new ValidationError(e.code, e.path, e.message),
  ),
  revision: doc.revision,
  rollbackFromVersionId: doc.rollbackFromVersionId
    ? toPolicyVersionId(doc.rollbackFromVersionId)
    : null,
  createdBy: buildUserId(doc.createdBy),
  createdAt: doc._creationTime,
  publishedAt: doc.publishedAt,
});
