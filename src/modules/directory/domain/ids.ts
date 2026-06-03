/**
 * Per D-14, domain IDs are branded strings — zero runtime cost.
 * The factory functions are used ONLY at adapter mapper boundaries;
 * domain and application code receives already-branded IDs.
 */
export type TenantId = string & { readonly __brand: "TenantId" };
export type UserId = string & { readonly __brand: "UserId" };
export type RoleId = string & { readonly __brand: "RoleId" };

export const tenantId = (raw: string): TenantId => raw as TenantId;
export const userId = (raw: string): UserId => raw as UserId;
export const roleId = (raw: string): RoleId => raw as RoleId;
