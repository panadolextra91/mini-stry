import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useDemoContext } from "../../app/context/DemoContext";

export function usePolicies() {
  const { tenantId } = useDemoContext();
  return useQuery(api.policy.listPolicies, tenantId ? { tenantId } : "skip");
}

export function useVersions(policyId: string | null) {
  const { tenantId } = useDemoContext();
  return useQuery(
    api.policy.listVersions,
    tenantId && policyId ? { tenantId, policyId } : "skip"
  );
}

export function useCreateDraft() {
  const { tenantId, actorId } = useDemoContext();
  const createDraft = useMutation(api.policy.createDraft);
  
  return async (policyId: string, content: any) => {
    if (!tenantId || !actorId) throw new Error("Missing context");
    return createDraft({
      tenantId,
      policyId,
      content,
      actorId,
    });
  };
}

export function useSaveDraft() {
  const { tenantId } = useDemoContext();
  const saveDraft = useMutation(api.policy.saveDraft);
  
  return async (versionId: string, content: any, expectedRevision: number) => {
    if (!tenantId) throw new Error("Missing context");
    return saveDraft({
      tenantId,
      versionId,
      content,
      expectedRevision,
    });
  };
}

export function usePublish() {
  const { tenantId } = useDemoContext();
  const publish = useMutation(api.policy.publish);
  
  return async (versionId: string) => {
    if (!tenantId) throw new Error("Missing context");
    return publish({
      tenantId,
      versionId,
    });
  };
}

export function useRollback() {
  const { tenantId, actorId } = useDemoContext();
  const rollback = useMutation(api.policy.rollback);
  
  return async (policyId: string, targetVersionId: string) => {
    if (!tenantId || !actorId) throw new Error("Missing context");
    return rollback({
      tenantId,
      policyId,
      targetVersionId,
      actorId,
    });
  };
}
