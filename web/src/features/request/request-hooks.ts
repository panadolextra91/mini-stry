import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useDemoContext } from "../../app/context/DemoContext";

export function useRequests() {
  const { tenantId } = useDemoContext();
  return useQuery(api.request.listRequests, tenantId ? { tenantId } : "skip");
}

export function useSubmitRequest() {
  const { tenantId, actorId } = useDemoContext();
  const submitRequest = useMutation(api.request.submitRequest);
  
  return async (requestType: string, context: unknown) => {
    if (!tenantId || !actorId) throw new Error("Missing context");
    return submitRequest({
      tenantId,
      actorId,
      requestType,
      context,
    });
  };
}
