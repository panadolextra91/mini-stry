import type { PolicyId, PolicyVersionId } from "../../domain/ids.js";
import type { Policy } from "../../domain/policy.js";
import type { TenantContext } from "@/modules/directory/index.js";
import type { PolicyRepositoryPort } from "../../ports/policy-repository.port.js";
import type { MutationCtx, QueryCtx } from "../../../../../convex/_generated/server.js";
import { fromTenantId } from "@/modules/directory/adapters/convex/mappers.js";
import { fromPolicyId, fromPolicyVersionId, toPolicyDomain } from "./mappers.js";

export class ConvexPolicyRepository implements PolicyRepositoryPort {
  constructor(private readonly db: MutationCtx["db"] | QueryCtx["db"]) {}

  async create(ctx: TenantContext, input: { name: string; requestType: string }): Promise<Policy> {
    if (!('insert' in this.db)) throw new Error("Mutations require MutationCtx");
    const id = await this.db.insert("policies", {
      tenantId: fromTenantId(ctx.tenantId),
      name: input.name,
      requestType: input.requestType,
      activeVersionId: null,
      createdAt: Date.now(),
    });
    const doc = await this.db.get(id);
    if (!doc) throw new Error("Policy creation failed");
    return toPolicyDomain(doc);
  }

  async findById(ctx: TenantContext, id: PolicyId): Promise<Policy | null> {
    const doc = await this.db.get(fromPolicyId(id));
    if (!doc) return null;
    if (doc.tenantId !== fromTenantId(ctx.tenantId)) return null;
    return toPolicyDomain(doc);
  }

  async findByRequestType(ctx: TenantContext, requestType: string): Promise<Policy | null> {
    const doc = await this.db
      .query("policies")
      .withIndex("by_tenant_request_type", (q) =>
        q.eq("tenantId", fromTenantId(ctx.tenantId)).eq("requestType", requestType),
      )
      .unique();
    if (!doc) return null;
    return toPolicyDomain(doc);
  }

  async updateActiveVersion(
    ctx: TenantContext,
    id: PolicyId,
    versionId: PolicyVersionId,
  ): Promise<Policy> {
    if (!('patch' in this.db)) throw new Error("Mutations require MutationCtx");
    const existing = await this.db.get(fromPolicyId(id));
    if (!existing || existing.tenantId !== fromTenantId(ctx.tenantId)) {
      throw new Error(`Policy ${id} not found in tenant ${ctx.tenantId}`);
    }
    await this.db.patch(fromPolicyId(id), { activeVersionId: fromPolicyVersionId(versionId) });
    const doc = await this.db.get(fromPolicyId(id));
    if (!doc) throw new Error("Policy update failed");
    return toPolicyDomain(doc);
  }
}

