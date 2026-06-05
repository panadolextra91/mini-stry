import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useDemoContext } from "../../app/context/DemoContext";

export function useInbox() {
  const { tenantId, actorId } = useDemoContext();
  return useQuery(
    api.approval.listInbox,
    tenantId && actorId ? { tenantId, actorId } : "skip"
  );
}

export function useApprove() {
  const { tenantId, actorId } = useDemoContext();
  const approve = useMutation(api.approval.approve);
  
  return async (taskId: string) => {
    if (!tenantId || !actorId) throw new Error("Missing context");
    return approve({ tenantId, actorId, taskId });
  };
}

export function useReject() {
  const { tenantId, actorId } = useDemoContext();
  const reject = useMutation(api.approval.reject);
  
  return async (taskId: string) => {
    if (!tenantId || !actorId) throw new Error("Missing context");
    return reject({ tenantId, actorId, taskId });
  };
}
