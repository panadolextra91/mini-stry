import type { PolicyId, PolicyVersionId } from "../domain/ids.js";
import type { Policy } from "../domain/policy.js";
import type { TenantContext } from "@/modules/directory/index.js";

export interface PolicyRepositoryPort {
  create(ctx: TenantContext, input: { name: string; requestType: string }): Promise<Policy>;
  findById(ctx: TenantContext, id: PolicyId): Promise<Policy | null>;
  findByRequestType(ctx: TenantContext, requestType: string): Promise<Policy | null>;
  updateActiveVersion(
    ctx: TenantContext,
    id: PolicyId,
    versionId: PolicyVersionId,
  ): Promise<Policy>;
}
