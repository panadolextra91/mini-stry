import type { TenantId } from "@/modules/directory/index.js";
import type { PolicyId, PolicyVersionId } from "./ids.js";

export interface Policy {
  readonly id: PolicyId;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly activeVersionId: PolicyVersionId | null;
  readonly createdAt: number; // epoch ms
}
