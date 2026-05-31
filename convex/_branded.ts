import { brandedString } from "convex-helpers/validators";
import type { Infer } from "convex/values";

export const vTenantIdString = brandedString("TenantId");
export type TenantIdString = Infer<typeof vTenantIdString>;

export const vUserIdString = brandedString("UserId");
export type UserIdString = Infer<typeof vUserIdString>;

export const vRoleIdString = brandedString("RoleId");
export type RoleIdString = Infer<typeof vRoleIdString>;
