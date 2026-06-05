import { useState } from "react";
import { usePolicies, useVersionHistory } from "./governance-hooks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function VersionHistory() {
  const policies = usePolicies();
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  
  const versions = useVersionHistory(selectedPolicyId);
  const [v1, setV1] = useState<Record<string, unknown> | null>(null);
  const [v2, setV2] = useState<Record<string, unknown> | null>(null);

  if (policies === undefined) {
    return <div className="p-4 text-sm text-muted-foreground">Loading policies...</div>;
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex flex-col gap-2 p-4 bg-card border-b border-border shrink-0">
        <label className="text-sm font-medium">Select Policy</label>
        <Select value={selectedPolicyId || undefined} onValueChange={setSelectedPolicyId}>
          <SelectTrigger className="w-full max-w-sm bg-background">
            <SelectValue placeholder="Choose a policy" />
          </SelectTrigger>
          <SelectContent>
            {policies.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {selectedPolicyId && versions && (
        <div className="flex flex-col flex-1 min-h-0 p-4 pt-0 gap-4">
          <div className="flex gap-4 shrink-0 mt-4">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-semibold uppercase">Version A</label>
              <Select value={v1?.id as string | undefined} onValueChange={(id) => setV1(versions.find(v => v.id === id) as unknown as Record<string, unknown>)}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map(v => (
                    <SelectItem key={v.id} value={v.id}>Version {v.versionNumber} ({v.status})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-semibold uppercase">Version B</label>
              <Select value={v2?.id as string | undefined} onValueChange={(id) => setV2(versions.find(v => v.id === id) as unknown as Record<string, unknown>)}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map(v => (
                    <SelectItem key={v.id} value={v.id}>Version {v.versionNumber} ({v.status})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex-1 flex gap-4 min-h-0">
            <div className="flex-1 border border-border rounded-md bg-secondary/10 overflow-auto p-4">
              {v1 ? (
                <pre className="text-xs font-mono text-muted-foreground">{JSON.stringify(v1.content, null, 2)}</pre>
              ) : (
                <div className="text-muted-foreground text-sm flex items-center justify-center h-full">Select a version to view</div>
              )}
            </div>
            <div className="flex-1 border border-border rounded-md bg-secondary/10 overflow-auto p-4">
              {v2 ? (
                <pre className="text-xs font-mono text-muted-foreground">{JSON.stringify(v2.content, null, 2)}</pre>
              ) : (
                <div className="text-muted-foreground text-sm flex items-center justify-center h-full">Select a version to view</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
