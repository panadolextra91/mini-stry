import { RequestForm } from "../features/request/RequestForm";
import { RequestLog } from "../features/request/RequestLog";

export function RequestCenter() {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border bg-card shrink-0">
        <h1 className="text-xl font-semibold">Request Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Submit payloads and trace execution.</p>
      </div>
      
      <div className="flex-1 flex overflow-hidden p-4 gap-6">
        <div className="w-1/3 shrink-0 flex flex-col min-w-[300px]">
          <RequestForm />
        </div>
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <RequestLog />
        </div>
      </div>
    </div>
  );
}
