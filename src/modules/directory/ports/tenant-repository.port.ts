import type { TenantId } from "../domain/ids.js";
import type { Tenant } from "../domain/tenant.js";

export interface TenantRepositoryPort {
  /**
   * Note: No TenantContext required for tenant creation because the tenant does not exist yet.
   */
  create(input: { name: string }): Promise<Tenant>;

  /**
   * Note: No TenantContext required here; used by adapter to validate a TenantId resolves to a real tenant.
   */
  findById(id: TenantId): Promise<Tenant | null>;
}
