import { describe, it, expect } from "vitest";
import { setupRequest } from "../../_helpers/in-memory-fakes.js";
import { TENANT_A } from "../../_helpers/tenant-context-fixture.js";
import { AjvSchemaValidator, ruleId, autoApprove, autoReject, validateAndEvaluate } from "@/modules/runtime/index.js";
import { userId } from "@/modules/directory/index.js";

const ACTOR = userId("user_actor");
const VALID_CONTENT = {
  rules: [
    {
      id: ruleId("R1"),
      when: { type: "compare" as const, field: "amount", op: "gt" as const, value: 100 },
      decision: autoApprove(),
    },
  ],
  defaultDecision: autoReject(),
};

describe("Deterministic Replay (D-42)", () => {
  it("reproduces decision and evaluationTrace exactly from immutable content, input, and minimal trace", async () => {
    const validator = new AjvSchemaValidator();
    const { runtimeService, policyService } = setupRequest(validator);

    // Seed policy
    const policy = await policyService.createPolicy(TENANT_A, { name: "Replay Test", requestType: "replay_request" });
    const draft = await policyService.createDraft(TENANT_A, policy.id, VALID_CONTENT, ACTOR);
    await policyService.publishDraft(TENANT_A, draft.id);

    // Submit request (original evaluation)
    const original = await runtimeService.submit(TENANT_A, {
      requestType: "replay_request",
      context: { amount: 200 },
    });

    expect(original.status).toBe("completed");

    // Fetch the active version content (immutable published policy content)
    const activeVersion = await policyService.getActiveVersion(TENANT_A, policy.id);
    expect(activeVersion).not.toBeNull();
    expect(activeVersion!.id).toBe(original.policyVersionId);

    // Replay evaluation: execute the pure TS evaluator again using the same inputs
    const replayed = validateAndEvaluate(validator, activeVersion!.content, original.requestInput);

    // Assert decision matches
    expect(replayed.decision).toEqual(original.decision);
    
    // Assert evaluation trace matches
    expect(replayed.evaluationTrace).toEqual(original.trace);

    // Assert trace entries have only ruleId and matched keys (minimal-trace invariant, D-42)
    for (const entry of original.trace) {
      const keys = Object.keys(entry);
      expect(keys).toEqual(expect.arrayContaining(["ruleId", "matched"]));
      expect(keys).toHaveLength(2);
    }
  });
});
