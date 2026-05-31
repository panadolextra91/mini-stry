import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  {
    ignores: ["node_modules/", "dist/", "coverage/", "convex/_generated/", "*.config.js", "*.config.cjs"],
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
              message: "Cross-module deep imports forbidden. Import from '@/modules/directory' (barrel) instead — Module Boundary Rule (D-08)."
            },
            {
              target: "./src/modules/!(policy)/**/*",
              from: "./src/modules/policy/{domain,application,adapters}/**/*",
              message: "Cross-module deep imports forbidden. Import from '@/modules/policy' (barrel) instead — Module Boundary Rule (D-08)."
            },
            {
              target: "./src/modules/!(audit)/**/*",
              from: "./src/modules/audit/{domain,application,adapters}/**/*",
              message: "Cross-module deep imports forbidden. Import from '@/modules/audit' (barrel) instead — Module Boundary Rule (D-08)."
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
