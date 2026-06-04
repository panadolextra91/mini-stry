import type { PolicyId, PolicyVersionId } from "../../domain/ids.js";
import type { PolicyVersion } from "../../domain/policy-version.js";
import type { TenantContext } from "@/modules/directory/index.js";
import type {
  PolicyVersionRepositoryPort,
  CreateDraftInput,
  UpdateDraftPatch,
} from "../../ports/policy-version-repository.port.js";
import type { MutationCtx, QueryCtx } from "../../../../../convex/_generated/server.js";
import { fromTenantId } from "@/modules/directory/adapters/convex/mappers.js";
import { fromPolicyId, fromPolicyVersionId, toPolicyVersionDomain } from "./mappers.js";

export class ConvexPolicyVersionRepository implements PolicyVersionRepositoryPort {
  constructor(private readonly db: MutationCtx["db"] | QueryCtx["db"]) {}

  async create(ctx: TenantContext, input: CreateDraftInput): Promise<PolicyVersion> {
    if (!("insert" in this.db)) throw new Error("Mutations require MutationCtx");
    const id = await this.db.insert("policyVersions", {
      tenantId: fromTenantId(ctx.tenantId),
      policyId: fromPolicyId(input.policyId),
      versionNumber: input.versionNumber,
      content: input.content,
      status: "draft",
      validationStatus: input.validationStatus,
      validationErrors: input.validationErrors.map((e) => ({
        code: e.code,
        path: e.path,
        message: e.message,
      })),
      revision: 0,
      rollbackFromVersionId: input.rollbackFromVersionId
        ? fromPolicyVersionId(input.rollbackFromVersionId)
        : null,
      createdBy: input.createdBy as string,
      publishedAt: null,
    });
    const doc = await this.db.get(id);
    if (!doc) throw new Error("PolicyVersion creation failed");
    return toPolicyVersionDomain(doc);
  }

  async findById(ctx: TenantContext, id: PolicyVersionId): Promise<PolicyVersion | null> {
    const doc = await this.db.get(fromPolicyVersionId(id));
    if (!doc) return null;
    if (doc.tenantId !== fromTenantId(ctx.tenantId)) return null;
    return toPolicyVersionDomain(doc);
  }

  async findDraftByPolicy(ctx: TenantContext, policyId: PolicyId): Promise<PolicyVersion | null> {
    const doc = await this.db
      .query("policyVersions")
      .withIndex("by_tenant_policy_status", (q) =>
        q
          .eq("tenantId", fromTenantId(ctx.tenantId))
          .eq("policyId", fromPolicyId(policyId))
          .eq("status", "draft"),
      )
      .first();
    return doc ? toPolicyVersionDomain(doc) : null;
  }

  async listByPolicy(ctx: TenantContext, policyId: PolicyId): Promise<PolicyVersion[]> {
    const docs = await this.db
      .query("policyVersions")
      .withIndex("by_tenant_policy_version", (q) =>
        q.eq("tenantId", fromTenantId(ctx.tenantId)).eq("policyId", fromPolicyId(policyId)),
      )
      .order("desc")
      .take(100);
    return docs.map(toPolicyVersionDomain);
  }

  async update(
    ctx: TenantContext,
    id: PolicyVersionId,
    patch: UpdateDraftPatch,
  ): Promise<PolicyVersion> {
    if (!("patch" in this.db)) throw new Error("Mutations require MutationCtx");
    const existing = await this.db.get(fromPolicyVersionId(id));
    if (!existing || existing.tenantId !== fromTenantId(ctx.tenantId)) {
      throw new Error(`PolicyVersion ${id} not found in tenant ${ctx.tenantId}`);
    }

    const patchData: Record<string, unknown> = {
      revision: patch.revision,
    };
    if (patch.content !== undefined) patchData.content = patch.content;
    if (patch.validationStatus !== undefined) patchData.validationStatus = patch.validationStatus;
    if (patch.validationErrors !== undefined) {
      patchData.validationErrors = patch.validationErrors.map((e) => ({
        code: e.code,
        path: e.path,
        message: e.message,
      }));
    }
    if (patch.status !== undefined) patchData.status = patch.status;
    if (patch.publishedAt !== undefined) patchData.publishedAt = patch.publishedAt;

    await (this.db as MutationCtx["db"]).patch(fromPolicyVersionId(id), patchData);
    const doc = await this.db.get(fromPolicyVersionId(id));
    if (!doc) throw new Error("PolicyVersion update failed");
    return toPolicyVersionDomain(doc);
  }

  /**
   * Returns the next available version number for a policy.
   *
   * **MVP note:** The current design (query max + 1) is acceptable for MVP.
   * Future production implementations must allocate version numbers atomically
   * within a single persistence transaction to prevent race conditions.
   */
  async getNextVersionNumber(ctx: TenantContext, policyId: PolicyId): Promise<number> {
    const docs = await this.db
      .query("policyVersions")
      .withIndex("by_tenant_policy_version", (q) =>
        q.eq("tenantId", fromTenantId(ctx.tenantId)).eq("policyId", fromPolicyId(policyId)),
      )
      .collect();

    let max = 0;
    for (const doc of docs) {
      if (doc.versionNumber > max) max = doc.versionNumber;
    }
    return max + 1;
  }
}
