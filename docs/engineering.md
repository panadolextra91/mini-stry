# Engineering Requirements

## Philosophy

Mini-stry is a policy-driven platform.

The policy engine is the core product.

Business rule correctness is more important than feature count.

Engineering decisions should prioritize:

* correctness
* maintainability
* simplicity
* testability

over speed of implementation.

---

## Testing Requirements

All business logic must be tested.

No policy evaluation logic should be merged without tests.

Required:

* Unit Tests
* Integration Tests for critical workflows

Testing Stack:

* Vitest
* React Testing Library

Coverage Targets:

* Policy Engine: 100%
* Policy Versioning: 100%
* Approval Workflow Generation: 100%
* Critical Business Logic: 90%+

Examples:

* policy evaluation
* policy publishing
* policy rollback
* approver assignment
* approval chain generation

must have test coverage.

---

## CI/CD Requirements

GitHub Actions

Pull Request Pipeline:

1. Install dependencies
2. Lint
3. Type Check
4. Run Tests
5. Build Verification

Merge should be blocked if any step fails.

Main Branch Pipeline:

1. Install dependencies
2. Lint
3. Type Check
4. Run Tests
5. Build
6. Deploy

Deployment Targets:

Frontend:

* Vercel

Backend:

* Convex

---

## Architecture Rules

Policy Engine must be isolated from UI.

The engine should be implemented as a standalone module.

UI components must not contain business rules.

All business decisions should be evaluated by the policy engine.

Avoid:

* hardcoded approval logic
* tenant-specific conditions
* special-case business logic

Business behavior should always come from policies.

---

## Code Quality

Requirements:

* TypeScript strict mode
* ESLint
* Prettier

No usage of:

* any
* eval()
* dynamic code execution

Prefer:

* deterministic logic
* pure functions
* explicit types

---

## MVP Principle

Do not optimize for scale.

Do not introduce unnecessary abstractions.

Prefer boring solutions.

Ship the smallest working version first.

The goal is validation of the policy engine concept.
