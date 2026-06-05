import { useState } from "react";
import { useSubmitRequest } from "./request-hooks";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function RequestForm() {
  const submitRequestMutation = useSubmitRequest();
  const [requestType, setRequestType] = useState("EXPENSE");
  const [contextInput, setContextInput] = useState('{\n  "amount": 500,\n  "department": "IT"\n}');

  const handleSubmit = async () => {
    try {
      const parsedContext = JSON.parse(contextInput);
      await submitRequestMutation(requestType, parsedContext);
      toast.success("Request submitted.");
    } catch (err: unknown) {
      if (err instanceof SyntaxError) {
        toast.error("That payload isn't valid JSON. Check for a trailing comma or unquoted key, then submit again.");
      } else {
        toast.error("Failed to submit request.");
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border border-border rounded-md bg-card">
      <h3 className="font-semibold text-foreground">New Evaluation Context</h3>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Request Type</label>
        <Input value={requestType} onChange={(e) => setRequestType(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Payload (JSON)</label>
        <Textarea 
          className="font-mono text-xs h-40" 
          value={contextInput} 
          onChange={(e) => setContextInput(e.target.value)} 
        />
      </div>
      <Button onClick={handleSubmit} className="w-full">Submit request</Button>
    </div>
  );
}
