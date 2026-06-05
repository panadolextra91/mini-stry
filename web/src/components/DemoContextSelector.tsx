import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useDemoContext } from "../app/context/DemoContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Id } from "../../../convex/_generated/dataModel";

export function DemoContextSelector() {
  const { tenantId, actorId, setTenantId, setActorId } = useDemoContext();
  const tenants = useQuery(api.directory.listTenants);
  const users = useQuery(api.directory.listUsersByTenant, tenantId ? { tenantId: tenantId as Id<"tenants"> } : "skip");

  const handleTenantChange = (newTenantId: string) => {
    setTenantId(newTenantId);
    setActorId(null);
  };

  return (
    <div className="flex flex-col gap-4 p-4 border-b border-border bg-card">
      <div className="flex flex-col gap-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active Tenant</label>
        <Select value={tenantId || undefined} onValueChange={handleTenantChange}>
          <SelectTrigger className="w-full bg-background border-border">
            <SelectValue placeholder="Select tenant" />
          </SelectTrigger>
          <SelectContent>
            {tenants?.map((t) => (
              <SelectItem key={t._id} value={t._id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active User</label>
        <Select value={actorId || undefined} onValueChange={setActorId} disabled={!tenantId}>
          <SelectTrigger className="w-full bg-background border-border">
            <SelectValue placeholder={tenantId ? "Select user" : "Select tenant first"} />
          </SelectTrigger>
          <SelectContent>
            {users?.map((u) => (
              <SelectItem key={u._id} value={u._id}>
                {u.name || u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
