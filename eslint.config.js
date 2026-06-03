import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  {
    ignores: ["node_modules/", "dist/", "coverage/", "convex/_generated/", "*.config.js", "*.config.cjs", ".agent/", ".claude/", ".codex/", ".gemini/"],
  },
  {
    files: ["src/**/*.ts", "convex/**/*.ts", "tests/**/*.ts"],
    plugins: {
      import: importPlugin,
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: "./tsconfig.json" },
    },
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
      },
    },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/modules/!(directory)/**/*",
              from: "./src/modules/directory/{domain,application,adapters}/**/*",
              except: ["**/directory/adapters/convex/mappers.ts"],
              message: "Cross-module deep imports forbidden. Import from '@/modules/directory' (barrel) instead — Module Boundary Rule (D-08)."
            },
            {
              target: "./src/modules/!(policy)/**/*",
              from: "./src/modules/policy/{domain,application,adapters}/**/*",
              except: ["**/policy/adapters/convex/mappers.ts"],
              message: "Cross-module deep imports forbidden. Import from '@/modules/policy' (barrel) instead — Module Boundary Rule (D-08)."
            },
            {
              target: "./src/modules/!(audit)/**/*",
              from: "./src/modules/audit/{domain,application,adapters}/**/*",
              message: "Cross-module deep imports forbidden. Import from '@/modules/audit' (barrel) instead — Module Boundary Rule (D-08)."
            },
            {
              target: "./src/modules/!(runtime)/**/*",
              from: "./src/modules/runtime/{domain,application,adapters}/**/*",
              message: "Cross-module deep imports forbidden. Import from '@/modules/runtime' (barrel) instead — Module Boundary Rule (D-08)."
            },
            {
              target: "./src/modules/!(request)/**/*",
              from: "./src/modules/request/{domain,application,adapters}/**/*",
              except: ["**/request/adapters/convex/mappers.ts"],
              message: "Cross-module deep imports forbidden. Import from '@/modules/request' (barrel) instead — Module Boundary Rule (D-08)."
            },
            {
              target: "./src/modules/!(approval)/**/*",
              from: "./src/modules/approval/{domain,application,adapters}/**/*",
              except: ["**/approval/adapters/convex/mappers.ts"],
              message: "Cross-module deep imports forbidden. Import from '@/modules/approval' (barrel) instead — Module Boundary Rule (D-08)."
            },
            {
              target: "./src/modules/*/domain/**/*",
              from: "./src/modules/*/{application,adapters}/**/*",
              message: "Domain layer must remain pure — no application or adapter imports."
            },
            {
              target: "./src/modules/*/application/**/*",
              from: "./src/modules/*/adapters/**/*",
              message: "Application services must not import adapters — depend on ports only."
            },
            {
              target: "./convex/**/*",
              from: "./src/modules/*/domain/**/*",
              except: ["./src/modules/*/domain/ids.ts"],
              message: "convex/ may not import domain entities directly. Use module barrel to access service types only."
            },
            {
              target: "./convex/**/*",
              from: ["./src/modules/*/application/**/*", "./src/modules/*/domain/!(ids).ts", "./src/modules/*/domain/!(ids)/**/*"],
              message: "convex/ handlers must import services, contexts, and error types through @/modules/<mod> barrel. Adapter implementations (./adapters/convex/**) may still be deep-imported for DI wiring."
            }
          ],
        },
      ],
      "@typescript-eslint/no-explicit-any": "error"
    },
  }
);
