import { useVersions, useRollback, usePolicies, useCreateDraft } from "./policy-hooks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";

export function VersionPanel({ policyId }: { policyId: string }) {
  const versions = useVersions(policyId);
  const policies = usePolicies();
  const rollbackMutation = useRollback();
  const createDraftMutation = useCreateDraft();
  
  const policy = policies?.find(p => p._id === policyId);
  const [isRollbackOpen, setIsRollbackOpen] = useState(false);
  const [targetVersion, setTargetVersion] = useState<{ _id: string, versionNumber: number } | null>(null);

  if (versions === undefined || policies === undefined) {
    return <div className="p-4 text-sm text-muted-foreground">Loading versions...</div>;
  }

  const activeVersionId = policy?.activeVersionId;
  const sortedVersions = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const hasDraft = sortedVersions.some(v => v.status === "draft");

  const handleCreateDraft = async () => {
    try {
      await createDraftMutation(policyId, { rules: [], defaultDecision: { kind: "auto-reject" } });
      toast.success("Draft created.");
    } catch {
      toast.error("Failed to create draft.");
    }
  };

  const handleRollback = async () => {
    if (!targetVersion) return;
    try {
      await rollbackMutation(policyId, targetVersion._id);
      toast.success(`Rolled back to version ${targetVersion.versionNumber}`);
      setIsRollbackOpen(false);
    } catch {
      toast.error("Failed to roll back.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-secondary/20">
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-card/50">
        <h3 className="font-semibold text-foreground">Lifecycle & Versions</h3>
        {!hasDraft && (
          <Button variant="outline" size="sm" onClick={handleCreateDraft}>New draft</Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {sortedVersions.map(v => {
          const isActive = v._id === activeVersionId;
          const isDraft = v.status === "draft";
          
          return (
            <div 
              key={v._id} 
              className={cn(
                "flex flex-col gap-2 p-3 rounded-md border",
                isActive ? "border-primary bg-primary/10" : "border-border bg-card",
                isDraft && "border-dashed"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("font-medium", isActive ? "text-primary" : "text-foreground")}>
                  Version {v.versionNumber}
                </span>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  isDraft ? "bg-muted text-muted-foreground" : 
                  isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                )}>
                  {isDraft ? "Draft" : isActive ? "Active" : "Published"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {isDraft ? "Currently editing" : `Published on ${new Date(v.publishedAt!).toLocaleString()}`}
              </div>
              
              {!isActive && !isDraft && (
                <div className="mt-2 flex gap-2">
                  <Dialog open={isRollbackOpen && targetVersion?._id === v._id} onOpenChange={(open) => {
                    if (open) setTargetVersion(v);
                    setIsRollbackOpen(open);
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="secondary" size="sm" className="w-full">Roll back to this version</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirm Rollback</DialogTitle>
                        <DialogDescription>
                          Roll back to version {v.versionNumber}? This will make it the active version immediately.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRollbackOpen(false)}>Cancel</Button>
                        <Button onClick={handleRollback}>Roll back</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
