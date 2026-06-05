import { useInbox, useApprove, useReject } from "./inbox-hooks";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function InboxList() {
  const inboxTasks = useInbox();
  const approveMutation = useApprove();
  const rejectMutation = useReject();
  const [rejectingTaskId, setRejectingTaskId] = useState<string | null>(null);

  if (inboxTasks === undefined) {
    return <div className="p-4 text-sm text-muted-foreground">Loading inbox...</div>;
  }

  if (inboxTasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-md bg-card/50">
        <h3 className="font-semibold mb-2">No tasks waiting on you</h3>
        <p className="text-muted-foreground text-center">
          Approvals assigned to the active user appear here automatically.
        </p>
      </div>
    );
  }

  const handleApprove = async (taskId: string) => {
    try {
      await approveMutation(taskId);
      toast.success("Task approved.");
    } catch {
      toast.error("Failed to approve task.");
    }
  };

  const handleReject = async (taskId: string) => {
    try {
      await rejectMutation(taskId);
      toast.success("Task rejected.");
      setRejectingTaskId(null);
    } catch {
      toast.error("Failed to reject task.");
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full overflow-y-auto pr-2">
      {inboxTasks.map(task => {
        const isPending = task.state === "PENDING";
        const isRejected = task.state === "REJECTED";
        
        return (
          <div key={task._id} className="flex flex-col border border-border rounded-md bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col gap-1">
                <span className="font-semibold">Stage: {task.stage}</span>
                <span className="text-sm text-muted-foreground font-mono">Request Evaluation: {task.requestEvaluationId}</span>
              </div>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold",
                isRejected ? "bg-destructive text-destructive-foreground" : 
                isPending ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
              )}>
                {task.state}
              </span>
            </div>
            
            {isPending && (
              <div className="flex gap-2 justify-end mt-2 pt-4 border-t border-border">
                <Dialog open={rejectingTaskId === task._id} onOpenChange={(open) => {
                  if (open) setRejectingTaskId(task._id);
                  else setRejectingTaskId(null);
                }}>
                  <DialogTrigger asChild>
                    <Button variant="destructive">Reject</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm Rejection</DialogTitle>
                      <DialogDescription>
                        Reject this approval task? This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setRejectingTaskId(null)}>Cancel</Button>
                      <Button variant="destructive" onClick={() => handleReject(task._id)}>Reject</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
                <Button onClick={() => handleApprove(task._id)}>Approve</Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
