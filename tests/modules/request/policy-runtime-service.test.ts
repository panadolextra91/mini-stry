import { describe, it, expect, vi } from "vitest";
import { setupRequest } from "../../_helpers/in-memory-fakes.js";
import { TENANT_A, TENANT_B } from "../../_helpers/tenant-context-fixture.js";
import {
  AjvSchemaValidator,
  autoApprove,
  autoReject,
  ruleId,
  EvaluationError,
} from "@/modules/runtime/index.js";
import { userId } from "@/modules/directory/index.js";
import { PolicyNotFoundForRequestType, NoActivePolicyError } from "@/modules/request/index.js";

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

describe("PolicyRuntimeService", () => {
  describe("submit — success path", () => {
    it("resolves requestType → evaluates → persists completed record", async () => {
      const { runtimeService, policyService, evalRepo } = setupRequest(new AjvSchemaValidator());

      // Seed a policy with an active published version
      const policy = await policyService.createPolicy(TENANT_A, { name: "Expense Policy", requestType: "expense_request" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, VALID_CONTENT, ACTOR);
      await policyService.publishDraft(TENANT_A, draft.id);

      const result = await runtimeService.submit(TENANT_A, {
        requestType: "expense_request",
        context: { amount: 200 },
      });

      expect(result.status).toBe("completed");
      expect(result.decision).not.toBeNull();
      expect(result.decision!.kind).toBe("auto-approve");
      expect(result.policyVersionId).toBe(draft.id);
      expect(result.requestInput).toEqual({ amount: 200 });
      expect(result.trace.length).toBeGreaterThan(0);
      expect(result.errorCode).toBeNull();
      expect(result.fieldPath).toBeNull();

      // Verify it was persisted
      const persisted = await evalRepo.findById(TENANT_A, result.id);
      expect(persisted).not.toBeNull();
      expect(persisted!.id).toBe(result.id);
    });

    it("emits RequestEvaluated event on success", async () => {
      const { runtimeService, policyService, requestDispatcher } = setupRequest(new AjvSchemaValidator());
      const handler = vi.fn();
      requestDispatcher.on("RequestEvaluated", handler);

      const policy = await policyService.createPolicy(TENANT_A, { name: "Event Test", requestType: "event_request" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, VALID_CONTENT, ACTOR);
      await policyService.publishDraft(TENANT_A, draft.id);

      const result = await runtimeService.submit(TENANT_A, {
        requestType: "event_request",
        context: { amount: 200 },
      });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0]![0]).toMatchObject({
        tenantId: TENANT_A.tenantId,
        evaluationRecordId: result.id,
      });
    });

    it("returns default decision when no rule matches", async () => {
      const { runtimeService, policyService } = setupRequest(new AjvSchemaValidator());

      const policy = await policyService.createPolicy(TENANT_A, { name: "Default Test", requestType: "default_request" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, VALID_CONTENT, ACTOR);
      await policyService.publishDraft(TENANT_A, draft.id);

      const result = await runtimeService.submit(TENANT_A, {
        requestType: "default_request",
        context: { amount: 50 }, // amount <= 100, no rule matches
      });

      expect(result.status).toBe("completed");
      expect(result.decision!.kind).toBe("auto-reject"); // defaultDecision
    });
  });

  describe("submit — resolution failure path", () => {
    it("throws PolicyNotFoundForRequestType for unknown requestType", async () => {
      const { runtimeService } = setupRequest(new AjvSchemaValidator());

      await expect(
        runtimeService.submit(TENANT_A, {
          requestType: "nonexistent",
          context: {},
        }),
      ).rejects.toThrow(PolicyNotFoundForRequestType);
    });

    it("emits ResolutionFailed event on unknown requestType", async () => {
      const { runtimeService, requestDispatcher } = setupRequest(new AjvSchemaValidator());
      const handler = vi.fn();
      requestDispatcher.on("ResolutionFailed", handler);

      try {
        await runtimeService.submit(TENANT_A, {
          requestType: "nonexistent",
          context: {},
        });
      } catch {
        // expected
      }

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0]![0]).toMatchObject({
        tenantId: TENANT_A.tenantId,
        requestType: "nonexistent",
        reason: "POLICY_NOT_FOUND",
      });
    });

    it("throws NoActivePolicyError when policy has no active version", async () => {
      const { runtimeService, policyService } = setupRequest(new AjvSchemaValidator());

      // Create a policy but don't publish any version
      await policyService.createPolicy(TENANT_A, { name: "No Active", requestType: "no_active_request" });

      await expect(
        runtimeService.submit(TENANT_A, {
          requestType: "no_active_request",
          context: {},
        }),
      ).rejects.toThrow(NoActivePolicyError);
    });

    it("emits ResolutionFailed event when no active version exists", async () => {
      const { runtimeService, policyService, requestDispatcher } = setupRequest(new AjvSchemaValidator());
      const handler = vi.fn();
      requestDispatcher.on("ResolutionFailed", handler);

      await policyService.createPolicy(TENANT_A, { name: "No Version", requestType: "no_version_request" });

      try {
        await runtimeService.submit(TENANT_A, {
          requestType: "no_version_request",
          context: {},
        });
      } catch {
        // expected
      }

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0]![0]).toMatchObject({
        reason: "NO_ACTIVE_VERSION",
        requestType: "no_version_request",
      });
    });

    it("does NOT create a RequestEvaluation record on resolution failure (D-41)", async () => {
      const { runtimeService, evalRepo } = setupRequest(new AjvSchemaValidator());

      try {
        await runtimeService.submit(TENANT_A, {
          requestType: "nonexistent",
          context: {},
        });
      } catch {
        // expected
      }

      const records = await evalRepo.findByTenant(TENANT_A);
      expect(records).toHaveLength(0);
    });
  });

  describe("submit — contract violation path", () => {
    it("throws EvaluationError and creates failed record when field is missing", async () => {
      const { runtimeService, policyService, evalRepo } = setupRequest(new AjvSchemaValidator());

      const policy = await policyService.createPolicy(TENANT_A, { name: "Missing Field", requestType: "missing_field_request" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, VALID_CONTENT, ACTOR);
      await policyService.publishDraft(TENANT_A, draft.id);

      // Submit without the required 'amount' field
      await expect(
        runtimeService.submit(TENANT_A, {
          requestType: "missing_field_request",
          context: {}, // missing 'amount'
        }),
      ).rejects.toThrow(EvaluationError);

      // Failed record should exist
      const records = await evalRepo.findByTenant(TENANT_A);
      expect(records).toHaveLength(1);
      expect(records[0]!.status).toBe("failed");
      expect(records[0]!.decision).toBeNull();
      expect(records[0]!.errorCode).toBe("MISSING_FIELD");
      expect(records[0]!.fieldPath).toBe("amount");
    });

    it("emits EvaluationFailed event on contract violation", async () => {
      const { runtimeService, policyService, requestDispatcher } = setupRequest(new AjvSchemaValidator());
      const handler = vi.fn();
      requestDispatcher.on("EvaluationFailed", handler);

      const policy = await policyService.createPolicy(TENANT_A, { name: "Eval Fail", requestType: "eval_fail_request" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, VALID_CONTENT, ACTOR);
      await policyService.publishDraft(TENANT_A, draft.id);

      try {
        await runtimeService.submit(TENANT_A, {
          requestType: "eval_fail_request",
          context: {}, // missing 'amount'
        });
      } catch {
        // expected
      }

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0]![0]).toMatchObject({
        tenantId: TENANT_A.tenantId,
        errorCode: "MISSING_FIELD",
      });
    });

    it("rethrows EvaluationError after persisting failed record (D-40)", async () => {
      const { runtimeService, policyService } = setupRequest(new AjvSchemaValidator());

      const policy = await policyService.createPolicy(TENANT_A, { name: "Rethrow", requestType: "rethrow_request" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, VALID_CONTENT, ACTOR);
      await policyService.publishDraft(TENANT_A, draft.id);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let caught: any = null;
      try {
        await runtimeService.submit(TENANT_A, {
          requestType: "rethrow_request",
          context: {},
        });
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(EvaluationError);
      expect(caught.code).toBe("MISSING_FIELD");
    });
  });

  describe("tenant isolation", () => {
    it("tenant B cannot resolve tenant A's requestType", async () => {
      const { runtimeService, policyService } = setupRequest(new AjvSchemaValidator());

      // Seed in tenant A
      const policy = await policyService.createPolicy(TENANT_A, { name: "Isolation", requestType: "isolated_request" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, VALID_CONTENT, ACTOR);
      await policyService.publishDraft(TENANT_A, draft.id);

      // Tenant B should not resolve
      await expect(
        runtimeService.submit(TENANT_B, {
          requestType: "isolated_request",
          context: { amount: 200 },
        }),
      ).rejects.toThrow(PolicyNotFoundForRequestType);
    });
  });

  describe("trace entries", () => {
    it("persists only {ruleId, matched} in trace (D-42 minimal trace)", async () => {
      const { runtimeService, policyService } = setupRequest(new AjvSchemaValidator());

      const policy = await policyService.createPolicy(TENANT_A, { name: "Trace Test", requestType: "trace_request" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, VALID_CONTENT, ACTOR);
      await policyService.publishDraft(TENANT_A, draft.id);

      const result = await runtimeService.submit(TENANT_A, {
        requestType: "trace_request",
        context: { amount: 200 },
      });

      // Verify trace entries have only ruleId + matched (D-42)
      for (const entry of result.trace) {
        const keys = Object.keys(entry);
        expect(keys).toEqual(expect.arrayContaining(["ruleId", "matched"]));
        expect(keys).toHaveLength(2);
      }
    });
  });
});
