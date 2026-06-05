import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { MODEL_URI, configureMonacoJson } from "./monaco-setup";
import { useVersions, useSaveDraft, usePublish } from "./policy-hooks";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PolicyEditor({ policyId }: { policyId: string }) {
  const versions = useVersions(policyId);
  const saveDraftMutation = useSaveDraft();
  const publishMutation = usePublish();

  const draftVersion = versions?.find((v) => v.status === "draft");
  
  const [content, setContent] = useState<string>("");
  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    if (draftVersion && !initialLoaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContent(JSON.stringify(draftVersion.content, null, 2));
       
      setInitialLoaded(true);
    } else if (!draftVersion && initialLoaded) {
       
      setContent("");
       
      setInitialLoaded(false);
    }
  }, [draftVersion, initialLoaded]);

  const handleSave = async () => {
    if (!draftVersion) return;
    try {
      const parsed = JSON.parse(content);
      await saveDraftMutation(draftVersion._id, parsed, draftVersion.revision);
      toast.success("Draft saved successfully.");
    } catch (err: unknown) {
      if (err instanceof SyntaxError) {
        toast.error("Invalid JSON format. Save draft blocked until syntax is fixed.");
      } else {
        toast.error("Failed to save draft.");
      }
    }
  };

  const handlePublish = async () => {
    if (!draftVersion) return;
    try {
      await publishMutation(draftVersion._id);
      toast.success("Version published successfully.");
    } catch {
      toast.error("Publish blocked: the policy failed server validation.");
    }
  };

  if (versions === undefined) return <div className="p-4">Loading editor...</div>;
  if (!draftVersion) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] bg-background">
        <p className="text-muted-foreground text-center">Create a draft to start authoring JSON rules with live schema validation.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold">Editing Draft (v{draftVersion.versionNumber})</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleSave}>Save draft</Button>
          <Button onClick={handlePublish}>Publish version</Button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          path={MODEL_URI}
          defaultLanguage="json"
          value={content}
          onChange={(val) => setContent(val || "")}
          beforeMount={configureMonacoJson}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            formatOnPaste: true,
            formatOnType: true,
            scrollBeyondLastLine: false,
            padding: { top: 16 },
          }}
        />
      </div>
    </div>
  );
}
