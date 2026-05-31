import type { TenantId, UserId, RoleId } from "./ids.js";
export interface User {
  readonly id: UserId;
  readonly tenantId: TenantId;
  readonly email: string;
  readonly name: string | null;
  readonly roleId: RoleId;
  readonly managerId: UserId | null;
  readonly image: string | null;
  readonly emailVerificationTime: number | null;
  readonly isAnonymous: boolean | null;
  readonly phone: string | null;
  readonly createdAt: number; // epoch ms
}
