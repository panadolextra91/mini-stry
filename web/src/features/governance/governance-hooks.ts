import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useDemoContext } from "../../app/context/DemoContext";

export function useAuditLogs() {
  const { tenantId } = useDemoContext();
  return useQuery(api.audit.listAuditLogs, tenantId ? { tenantId } : "skip");
}

export function useVersionHistory(policyId: string | null) {
  const { tenantId } = useDemoContext();
  return useQuery(
    api.policy.listVersions,
    tenantId && policyId ? { tenantId, policyId } : "skip"
  );
}

export function usePolicies() {
  const { tenantId } = useDemoContext();
  return useQuery(api.policy.listPolicies, tenantId ? { tenantId } : "skip");
}
