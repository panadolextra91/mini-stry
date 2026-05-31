import { tenantContext, tenantId, type TenantContext } from "@/modules/directory/index.js";

export const TENANT_A: TenantContext = tenantContext(tenantId("tenant_a"));
export const TENANT_B: TenantContext = tenantContext(tenantId("tenant_b"));

export const makeTenantContext = (raw: string): TenantContext => tenantContext(tenantId(raw));
