import { AuditTimeline } from "../features/governance/AuditTimeline";
import { VersionHistory } from "../features/governance/VersionHistory";

export function Governance() {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border bg-card shrink-0">
        <h1 className="text-xl font-semibold">Governance & Audit</h1>
        <p className="text-sm text-muted-foreground mt-1">Tenant audit timeline and comparative policy version history.</p>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="w-[40%] shrink-0 border-r border-border flex flex-col p-4 bg-background">
          <h2 className="text-lg font-semibold mb-4">Audit Timeline</h2>
          <div className="flex-1 min-h-0">
            <AuditTimeline />
          </div>
        </div>
        <div className="w-[60%] shrink-0 flex flex-col bg-secondary/10">
          <VersionHistory />
        </div>
      </div>
    </div>
  );
}
