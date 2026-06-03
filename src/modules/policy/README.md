# Module: policy

## Status: skeleton at Phase 1

Entities and IDs only; PolicyRuntime + lifecycle land in Phase 2 / Phase 3.

## Public API

- **Entities**: Policy, PolicyVersion
- **Branded IDs**: PolicyId, PolicyVersionId (and factories)

## PolicyVersion.content

Warning: type is `unknown` by design (D-12 + RESEARCH.md). Phase 2 owns the JSON Schema; do NOT narrow this in Phase 1.

## Module Boundary Rule

"Cross-module imports are ALLOWED. Cross-module coupling is NOT."

Forbidden pattern (deep import):
`import { ... } from "@/modules/policy/domain/policy"`

Allowed pattern (barrel import):
`import { ... } from "@/modules/policy"`
