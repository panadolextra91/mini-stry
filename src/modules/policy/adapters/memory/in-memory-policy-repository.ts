import type { PolicyId, PolicyVersionId } from "../../domain/ids.js";
import type { Policy } from "../../domain/policy.js";
import type { TenantContext } from "@/modules/directory/index.js";
import type { PolicyRepositoryPort } from "../../ports/policy-repository.port.js";
import { policyId as buildPolicyId } from "../../domain/ids.js";

export class InMemoryPolicyRepository implements PolicyRepositoryPort {
  private readonly policies = new Map<PolicyId, Policy>();
  private idCounter = 1;

  async create(ctx: TenantContext, input: { name: string; requestType: string }): Promise<Policy> {
    const id = buildPolicyId(`policy_${this.idCounter++}`);
    const policy: Policy = {
      id,
      tenantId: ctx.tenantId,
      name: input.name,
      requestType: input.requestType,
      activeVersionId: null,
      createdAt: Date.now(),
    };
    this.policies.set(id, policy);
    return policy;
  }

  async findById(ctx: TenantContext, id: PolicyId): Promise<Policy | null> {
    const policy = this.policies.get(id);
    if (!policy) return null;
    if (policy.tenantId !== ctx.tenantId) return null;
    return policy;
  }

  async findByRequestType(ctx: TenantContext, requestType: string): Promise<Policy | null> {
    for (const policy of this.policies.values()) {
      if (policy.tenantId === ctx.tenantId && policy.requestType === requestType) {
        return policy;
      }
    }
    return null;
  }

  async listByTenant(ctx: TenantContext): Promise<Policy[]> {
    return [...this.policies.values()]
      .filter((p) => p.tenantId === ctx.tenantId)
      .reverse();
  }

  async updateActiveVersion(
    ctx: TenantContext,
    id: PolicyId,
    versionId: PolicyVersionId,
  ): Promise<Policy> {
    const policy = await this.findById(ctx, id);
    if (!policy) throw new Error(`Policy ${id} not found`);
    const updated = { ...policy, activeVersionId: versionId };
    this.policies.set(id, updated);
    return updated;
  }
}
