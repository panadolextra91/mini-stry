import type { Monaco } from "@monaco-editor/react";
// D-59: canonical schema artifact — same file the runtime barrel re-exports.
// Imported directly to avoid pulling in the full runtime barrel's transitive
// dependency graph (which uses backend @/ aliases incompatible with the web tsconfig).
import policyContentSchema from "../../../../src/modules/runtime/schema/policy-content.schema.json";

export const MODEL_URI = "file:///policy/draft.json";

export function configureMonacoJson(monaco: Monaco) {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    enableSchemaRequest: false,
    schemas: [
      {
        uri: "https://mini-stry.local/schema/policy-content.json",
        fileMatch: [MODEL_URI],
        schema: policyContentSchema as Record<string, unknown>,
      },
    ],
  });
}
