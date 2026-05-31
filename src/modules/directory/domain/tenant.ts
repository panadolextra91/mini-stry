import type { TenantId } from "./ids.js";
export interface Tenant {
  readonly id: TenantId;
  readonly name: string;
  readonly createdAt: number; // epoch ms
}
