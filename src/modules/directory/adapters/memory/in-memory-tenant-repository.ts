import type { TenantId } from "../../domain/ids.js";
import type { Tenant } from "../../domain/tenant.js";
import type { TenantRepositoryPort } from "../../ports/tenant-repository.port.js";
import { tenantId as buildTenantId } from "../../domain/ids.js";

export class InMemoryTenantRepository implements TenantRepositoryPort {
  private readonly tenants = new Map<TenantId, Tenant>();
  private idCounter = 1;

  async create(input: { name: string }): Promise<Tenant> {
    const id = buildTenantId(`tenant_${this.idCounter++}`);
    const tenant: Tenant = {
      id,
      name: input.name,
      createdAt: Date.now()
    };
    this.tenants.set(id, tenant);
    return tenant;
  }

  async findById(id: TenantId): Promise<Tenant | null> {
    return this.tenants.get(id) ?? null;
  }
}
