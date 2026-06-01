# Module: runtime

Pure functions over EvaluationContext. No TenantContext, no Convex, no consumers — just Policy → Decision.

## Public API
- **Types**: EvaluationContext, JsonValue, PolicyContent, Rule, RuleId, Predicate, ComparePredicate, Operator, Decision, EvaluationResult, TraceEntry
- **Decision factories**: autoApprove, autoReject, requestApproval
- **Schema validator**: SchemaValidatorPort, ValidationResult, AjvSchemaValidator (D-22)
- **Errors**: ValidationError, EvaluationError (codes: MISSING_FIELD | TYPE_MISMATCH | UNSUPPORTED_OPERATOR), PolicySchemaInvalidError (thrown by validateAndEvaluate when schema validation fails; carries `errors: readonly ValidationError[]`)
- **Canonical schema artifact**: src/modules/runtime/schema/policy-content.schema.json (D-23 — source of truth for runtime, lifecycle, and Monaco)

## Module Boundary Rule (D-08)
"Cross-module imports are ALLOWED. Cross-module coupling is NOT."

Forbidden: `import { AjvSchemaValidator } from "@/modules/runtime/adapters/ajv/ajv-schema-validator"`
Allowed:   `import { AjvSchemaValidator } from "@/modules/runtime"`

## What this module is NOT
- Not a service that takes TenantContext (Phase 4 PolicyRuntimeService wraps the runtime for tenant scoping).
- Not a Decision Consumer (Phase 5 ApprovalRoutingService subscribes to Decisions externally).
- Not a lifecycle owner (Phase 3 owns draft/publish/activate/rollback; it reuses SchemaValidatorPort at its boundaries).
