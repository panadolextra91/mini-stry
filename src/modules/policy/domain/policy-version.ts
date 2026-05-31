import type { TenantId } from "@/modules/directory/index.js";
import type { PolicyId, PolicyVersionId } from "./ids.js";

export interface PolicyVersion {
  readonly id: PolicyVersionId;
  readonly tenantId: TenantId;
  readonly policyId: PolicyId;
  readonly versionNumber: number;
  /**
   * Intentionally `unknown` at Phase 1. Phase 2's runtime owns the JSON Schema for content.
   * Do not narrow this type at Phase 1 — doing so couples storage to runtime concerns.
   */
  readonly content: unknown; // Phase 2 owns the shape — D-12 + RESEARCH.md Anti-Patterns
  readonly publishedAt: number | null; // null while draft; non-null after publish
}
