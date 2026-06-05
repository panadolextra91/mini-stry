import { usePolicies } from "./policy-hooks";
import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";

interface PolicyListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PolicyList({ selectedId, onSelect }: PolicyListProps) {
  const policies = usePolicies();

  if (policies === undefined) {
    return <div className="p-4 text-sm text-muted-foreground">Loading policies...</div>;
  }

  if (policies.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground italic border border-dashed border-border rounded bg-card/50">
        No policies for this tenant
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 w-full max-h-[300px] overflow-y-auto">
      {policies.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={cn(
            "flex items-center gap-3 px-3 py-2 text-sm text-left rounded-md transition-colors",
            selectedId === p.id
              ? "bg-primary/10 text-primary font-medium"
              : "text-foreground hover:bg-secondary"
          )}
        >
          <Shield className="w-4 h-4 shrink-0" />
          <div className="flex flex-col overflow-hidden">
            <span className="truncate">{p.name}</span>
            <span className="text-xs text-muted-foreground truncate">Active: {p.activeVersionId ? "Yes" : "No"}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
