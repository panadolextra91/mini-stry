import { useAuditLogs } from "./governance-hooks";

export function AuditTimeline() {
  const auditLogs = useAuditLogs();

  if (auditLogs === undefined) {
    return <div className="p-4 text-sm text-muted-foreground">Loading audit timeline...</div>;
  }

  if (auditLogs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-md bg-card/50 h-full">
        <h3 className="font-semibold mb-2">No audit activity</h3>
        <p className="text-muted-foreground text-center">
          Published versions, rollbacks, and decisions for this tenant will be recorded here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full h-full overflow-y-auto pr-2">
      {auditLogs.map(log => (
        <div key={log._id} className="flex flex-col gap-2 p-3 border border-border rounded-md bg-card">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-primary">{log.eventType}</span>
            <span className="text-xs text-muted-foreground font-mono">
              {new Date(log.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="text-xs font-mono text-muted-foreground bg-secondary/10 p-2 rounded whitespace-pre-wrap">
            {JSON.stringify(log.details, null, 2)}
          </div>
        </div>
      ))}
    </div>
  );
}
