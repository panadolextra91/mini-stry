import { useState } from "react";
import { PolicyList } from "../features/policy/PolicyList";
import { PolicyEditor } from "../features/policy/PolicyEditor";
import { VersionPanel } from "../features/policy/VersionPanel";

export function PolicyPortal() {
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header & List row */}
      <div className="p-4 border-b border-border bg-card shrink-0 flex gap-6 items-start">
        <div className="flex flex-col gap-1 w-64 shrink-0">
          <h1 className="text-xl font-semibold mb-2">Policy Portal</h1>
          <PolicyList selectedId={selectedPolicyId} onSelect={setSelectedPolicyId} />
        </div>
        <div className="flex-1 flex flex-col justify-center min-h-[100px]">
          {!selectedPolicyId && (
            <p className="text-muted-foreground">Select a policy to view its versions and edit drafts.</p>
          )}
        </div>
      </div>

      {/* Editor & Version Panel split */}
      {selectedPolicyId && (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-[65%] shrink-0 border-r border-border flex flex-col bg-background">
            <PolicyEditor policyId={selectedPolicyId} />
          </div>
          <div className="w-[35%] shrink-0 bg-secondary/20 flex flex-col">
            <VersionPanel policyId={selectedPolicyId} />
          </div>
        </div>
      )}
    </div>
  );
}
