import type { RoleId } from "@/modules/directory/index.js";

/**
 * D-29: Decision is a discriminated union by kind
 */
export type Decision =
  | { readonly kind: "auto-approve" }
  | { readonly kind: "auto-reject" }
  | { readonly kind: "request-approval"; readonly targetRoleId: RoleId };

export function autoApprove(): Decision {
  return { kind: "auto-approve" };
}

export function autoReject(): Decision {
  return { kind: "auto-reject" };
}

export function requestApproval(roleId: RoleId): Decision {
  return { kind: "request-approval", targetRoleId: roleId };
}
