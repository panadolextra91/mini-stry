import type { TenantId, RoleId } from "./ids.js";
export interface Role {
  readonly id: RoleId;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly createdAt: number; // epoch ms
}
