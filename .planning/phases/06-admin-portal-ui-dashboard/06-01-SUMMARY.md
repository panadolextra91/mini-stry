# Phase 6: Admin Portal UI Dashboard - Backend Read Paths (06-01)

## Summary
Successfully implemented the necessary backend read paths to unblock the Admin Portal UI development. This focused strictly on adhering to Hexagonal Architecture constraints, ensuring Convex functions contain no domain logic and only use standard repository patterns.

## Work Completed
1. **Policy & PolicyVersion Read Paths**: 
   - Added `listByTenant` to `PolicyRepositoryPort` and `listByPolicy` to `PolicyVersionRepositoryPort`.
   - Implemented in Convex adapters using `by_tenant_name` and `by_tenant_policy_version` indices respectively.
   - Added missing methods to `InMemory` adapters.
2. **ApprovalTask Read Paths**: 
   - Added `findByApprover` to `ApprovalTaskRepositoryPort` to list pending/completed tasks for a given approver.
   - Implemented using the `by_tenant_approver` index in Convex and `.filter().reverse()` in memory.
3. **Runtime Schema Parity**: 
   - Exported `policyContentSchema` directly from the runtime barrel (`src/modules/runtime/index.ts`).
   - Ensured the exact same JSON schema is used for validating Monaco editor content in UI.
4. **Tenant Isolation Testing**:
   - Implemented dedicated tests for `listByTenant`, `listByPolicy`, `findByApprover`, and `findByTenant` across Convex repositories (policy, approval, request, audit).

## Verification
- All tests passing.
- 100% test coverage maintained.
- Strict typechecks passing.

## Next Steps
Proceed to **Phase 06-02** (Vite SPA scaffolding).
