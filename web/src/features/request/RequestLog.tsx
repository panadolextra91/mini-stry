import { useRequests } from "./request-hooks";
import { cn } from "@/lib/utils";

export function RequestLog() {
  const requests = useRequests();

  if (requests === undefined) {
    return <div className="p-4 text-sm text-muted-foreground">Loading request log...</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-md bg-card/50">
        <h3 className="font-semibold mb-2">No requests yet</h3>
        <p className="text-muted-foreground text-center">
          Submit an EvaluationContext to run it against the active policy and watch the decision land here in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full h-full overflow-y-auto pr-2">
      {requests.map(req => {
        const isRejected = req.status === "rejected" || req.status === "auto-rejected";
        return (
          <div key={req._id} className="flex flex-col border border-border rounded-md bg-card overflow-hidden">
            <div className="p-3 border-b border-border flex items-center justify-between bg-secondary/10">
              <span className="font-semibold text-sm">Type: {req.requestType}</span>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold",
                isRejected ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
              )}>
                {req.status}
              </span>
            </div>
            <div className="p-3 flex flex-col gap-2 bg-background">
              <div className="text-xs font-semibold text-muted-foreground uppercase">Trace</div>
              {req.trace.map((entry: Record<string, unknown>, i: number) => (
                <div key={i} className="text-xs font-mono text-muted-foreground flex flex-col gap-1 border-l-2 border-border pl-2 mb-2">
                  <div className="font-medium text-foreground">{String(entry.step)}</div>
                  <pre className="whitespace-pre-wrap overflow-x-auto bg-secondary/20 p-2 rounded">
                    {JSON.stringify(entry.detail, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
