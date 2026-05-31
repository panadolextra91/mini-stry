import type { TenantId } from "../domain/ids.js";

/**
 * TenantContext is the first-class operational envelope (D-19).
 * Every service method takes `ctx: TenantContext` as the first parameter.
 * This parallels EvaluationContext (Phase 2). Ambient resolution is banned.
 */
export interface TenantContext {
  readonly tenantId: TenantId;
}

export const tenantContext = (tenantId: TenantId): TenantContext => ({ tenantId });
