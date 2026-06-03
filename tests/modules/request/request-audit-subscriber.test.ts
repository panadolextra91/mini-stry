import { describe, it, expect } from "vitest";
import { setupRequest } from "../../_helpers/in-memory-fakes.js";
import { TENANT_A } from "../../_helpers/tenant-context-fixture.js";
import { AjvSchemaValidator, EvaluationError, ruleId, autoApprove, autoReject } from "@/modules/runtime/index.js";
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

describe("RequestAuditSubscriber", () => {
  it("creates by-reference audit record on successful evaluation", async () => {
    const { runtimeService, policyService, auditRepo } = setupRequest(new AjvSchemaValidator());

    // Seed policy
    const policy = await policyService.createPolicy(TENANT_A, { name: "Audit Success", requestType: "audit_success" });
    const draft = await policyService.createDraft(TENANT_A, policy.id, VALID_CONTENT, ACTOR);
    await policyService.publishDraft(TENANT_A, draft.id);

    // Submit request
    const result = await runtimeService.submit(TENANT_A, {
      requestType: "audit_success",
      context: { amount: 200 },
    });

    const logs = await auditRepo.findByTenant(TENANT_A);
    const requestLogs = logs.filter(l => l.eventType.startsWith("request."));
    expect(requestLogs).toHaveLength(1);
    expect(requestLogs[0]!.eventType).toBe("request.evaluated");

    const payload = requestLogs[0]!.payload as Record<string, unknown>;
    expect(payload.tenantId).toBe(TENANT_A.tenantId);
    expect(payload.evaluationRecordId).toBe(result.id);

    // Ensure by-reference only (D-37): no requestInput, decision, or trace content
    expect(payload.requestInput).toBeUndefined();
    expect(payload.decision).toBeUndefined();
    expect(payload.trace).toBeUndefined();
  });

  it("creates by-reference audit record on contract violation", async () => {
    const { runtimeService, policyService, auditRepo } = setupRequest(new AjvSchemaValidator());

    // Seed policy
    const policy = await policyService.createPolicy(TENANT_A, { name: "Audit Fail", requestType: "audit_fail" });
    const draft = await policyService.createDraft(TENANT_A, policy.id, VALID_CONTENT, ACTOR);
    await policyService.publishDraft(TENANT_A, draft.id);

    // Submit request that triggers EvaluationError
    await expect(
      runtimeService.submit(TENANT_A, {
        requestType: "audit_fail",
        context: {}, // missing 'amount'
      }),
    ).rejects.toThrow(EvaluationError);

    const logs = await auditRepo.findByTenant(TENANT_A);
    const requestLogs = logs.filter(l => l.eventType.startsWith("request."));
    expect(requestLogs).toHaveLength(1);
    expect(requestLogs[0]!.eventType).toBe("request.evaluation_failed");

    const payload = requestLogs[0]!.payload as Record<string, unknown>;
    expect(payload.tenantId).toBe(TENANT_A.tenantId);
    expect(payload.evaluationRecordId).toBeDefined();
    expect(payload.errorCode).toBe("MISSING_FIELD");

    // Ensure by-reference only (D-37): no requestInput, decision, or trace content
    expect(payload.requestInput).toBeUndefined();
    expect(payload.decision).toBeUndefined();
    expect(payload.trace).toBeUndefined();
  });

  it("creates by-reference audit record on resolution failure", async () => {
    const { runtimeService, auditRepo } = setupRequest(new AjvSchemaValidator());

    // Submit unknown requestType
    await expect(
      runtimeService.submit(TENANT_A, {
        requestType: "nonexistent",
        context: {},
      }),
    ).rejects.toThrow();

    const logs = await auditRepo.findByTenant(TENANT_A);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.eventType).toBe("request.resolution_failed");

    const payload = logs[0]!.payload as Record<string, unknown>;
    expect(payload.tenantId).toBe(TENANT_A.tenantId);
    expect(payload.requestType).toBe("nonexistent");
    expect(payload.reason).toBe("POLICY_NOT_FOUND");
    // NO evaluationRecordId for resolution failure (D-41)
    expect(payload.evaluationRecordId).toBeUndefined();

    // Ensure by-reference only (D-37): no requestInput, decision, or trace content
    expect(payload.requestInput).toBeUndefined();
    expect(payload.decision).toBeUndefined();
    expect(payload.trace).toBeUndefined();
  });
});
