import type { PolicyId, PolicyVersionId } from "../../domain/ids.js";
import type { PolicyVersion } from "../../domain/policy-version.js";
import type { TenantContext } from "@/modules/directory/index.js";
import type {
  PolicyVersionRepositoryPort,
  CreateDraftInput,
  UpdateDraftPatch,
} from "../../ports/policy-version-repository.port.js";
import { policyVersionId as buildPolicyVersionId } from "../../domain/ids.js";

export class InMemoryPolicyVersionRepository
  implements PolicyVersionRepositoryPort
{
  private readonly versions = new Map<PolicyVersionId, PolicyVersion>();
  private idCounter = 1;

  async create(
    ctx: TenantContext,
    input: CreateDraftInput,
  ): Promise<PolicyVersion> {
    const id = buildPolicyVersionId(`pv_${this.idCounter++}`);
    const version: PolicyVersion = {
      id,
      tenantId: ctx.tenantId,
      policyId: input.policyId,
      versionNumber: input.versionNumber,
      content: input.content,
      status: "draft",
      validationStatus: input.validationStatus,
      validationErrors: input.validationErrors,
      revision: 0,
      rollbackFromVersionId: input.rollbackFromVersionId,
      createdBy: input.createdBy,
      createdAt: Date.now(),
      publishedAt: null,
    };
    this.versions.set(id, version);
    return version;
  }

  async findById(
    ctx: TenantContext,
    id: PolicyVersionId,
  ): Promise<PolicyVersion | null> {
    const version = this.versions.get(id);
    if (!version) return null;
    if (version.tenantId !== ctx.tenantId) return null;
    return version;
  }

  async findDraftByPolicy(
    ctx: TenantContext,
    policyId: PolicyId,
  ): Promise<PolicyVersion | null> {
    for (const version of this.versions.values()) {
      if (
        version.tenantId === ctx.tenantId &&
        version.policyId === policyId &&
        version.status === "draft"
      ) {
        return version;
      }
    }
    return null;
  }

  async update(
    ctx: TenantContext,
    id: PolicyVersionId,
    patch: UpdateDraftPatch,
  ): Promise<PolicyVersion> {
    const version = await this.findById(ctx, id);
    if (!version) throw new Error(`PolicyVersion ${id} not found`);
    const updated: PolicyVersion = {
      ...version,
      content: patch.content !== undefined ? patch.content : version.content,
      validationStatus:
        patch.validationStatus !== undefined
          ? patch.validationStatus
          : version.validationStatus,
      validationErrors:
        patch.validationErrors !== undefined
          ? patch.validationErrors
          : version.validationErrors,
      revision: patch.revision,
      status: patch.status !== undefined ? patch.status : version.status,
      publishedAt:
        patch.publishedAt !== undefined
          ? patch.publishedAt
          : version.publishedAt,
    };
    this.versions.set(id, updated);
    return updated;
  }

  async getNextVersionNumber(
    ctx: TenantContext,
    policyId: PolicyId,
  ): Promise<number> {
    let max = 0;
    for (const version of this.versions.values()) {
      if (
        version.tenantId === ctx.tenantId &&
        version.policyId === policyId &&
        version.versionNumber > max
      ) {
        max = version.versionNumber;
      }
    }
    return max + 1;
  }
}
