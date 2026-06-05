import type { Monaco } from "@monaco-editor/react";
// @ts-ignore
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
        schema: policyContentSchema,
      },
    ],
  });
}
