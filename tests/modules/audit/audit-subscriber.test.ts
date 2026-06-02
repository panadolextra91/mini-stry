import { describe, it, expect } from "vitest";
import { setupPolicy } from "../../_helpers/in-memory-fakes.js";
import { TENANT_A } from "../../_helpers/tenant-context-fixture.js";
import type { SchemaValidatorPort, ValidationResult } from "@/modules/runtime/index.js";
import { userId } from "@/modules/directory/index.js";

const ACTOR = userId("user_actor");

function alwaysValidValidator(): SchemaValidatorPort {
  return {
    validate: () => ({ ok: true, value: {} } as ValidationResult),
  };
}

describe("AuditEventSubscriber", () => {
  it("creates audit record on DraftCreated", async () => {
    const { policyService, auditRepo } = setupPolicy(alwaysValidValidator());
    const policy = await policyService.createPolicy(TENANT_A, { name: "Audit Draft" });
    await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

    const logs = await auditRepo.findByTenant(TENANT_A);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.eventType).toBe("policy.draft_created");
    const payload = logs[0]!.payload as Record<string, unknown>;
    expect(payload.rollbackFromVersionId).toBeNull();
  });

  it("creates audit record with rollbackFromVersionId on rollback", async () => {
    const { policyService, auditRepo } = setupPolicy(alwaysValidValidator());
    const policy = await policyService.createPolicy(TENANT_A, { name: "Audit Rollback" });

    const v1 = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);
    await policyService.publishDraft(TENANT_A, v1.id);

    const v2 = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);
    await policyService.publishDraft(TENANT_A, v2.id);

    // Rollback to v1
    await policyService.rollback(TENANT_A, policy.id, v1.id, ACTOR);

    const logs = await auditRepo.findByTenant(TENANT_A);
    // Expected: draft_created(v1), published(v1), draft_created(v2), published(v2), draft_created(rollback)
    const rollbackLog = logs.find((l) => {
      const p = l.payload as Record<string, unknown>;
      return l.eventType === "policy.draft_created" && p.rollbackFromVersionId != null;
    });
    expect(rollbackLog).toBeDefined();
    const rollbackPayload = rollbackLog!.payload as Record<string, unknown>;
    expect(rollbackPayload.rollbackFromVersionId).toBe(v1.id);
  });

  it("creates audit record on DraftUpdated", async () => {
    const { policyService, auditRepo } = setupPolicy(alwaysValidValidator());
    const policy = await policyService.createPolicy(TENANT_A, { name: "Audit Update" });
    const draft = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);
    await policyService.saveDraft(TENANT_A, draft.id, { v: 2 }, 0);

    const logs = await auditRepo.findByTenant(TENANT_A);
    const updateLog = logs.find((l) => l.eventType === "policy.draft_updated");
    expect(updateLog).toBeDefined();
    const payload = updateLog!.payload as Record<string, unknown>;
    expect(payload.policyVersionId).toBe(draft.id);
  });

  it("creates audit record on PolicyPublished", async () => {
    const { policyService, auditRepo } = setupPolicy(alwaysValidValidator());
    const policy = await policyService.createPolicy(TENANT_A, { name: "Audit Publish" });
    const draft = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);
    await policyService.publishDraft(TENANT_A, draft.id);

    const logs = await auditRepo.findByTenant(TENANT_A);
    const publishLog = logs.find((l) => l.eventType === "policy.published");
    expect(publishLog).toBeDefined();
    const payload = publishLog!.payload as Record<string, unknown>;
    expect(payload.actorId).toBe(ACTOR);
  });

  it("full lifecycle produces correct audit records", async () => {
    const { policyService, auditRepo } = setupPolicy(alwaysValidValidator());
    const policy = await policyService.createPolicy(TENANT_A, { name: "Full Audit" });

    // v1: create → save → publish
    const v1 = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);
    await policyService.saveDraft(TENANT_A, v1.id, { v: 1 }, 0);
    await policyService.publishDraft(TENANT_A, v1.id);

    // rollback to v1 → creates v2 draft → publish v2
    const v2 = await policyService.rollback(TENANT_A, policy.id, v1.id, ACTOR);
    await policyService.publishDraft(TENANT_A, v2.id);

    const logs = await auditRepo.findByTenant(TENANT_A);
    const eventTypes = logs.map((l) => l.eventType);
    // draft_created, draft_updated, published, draft_created(rollback), published
    expect(eventTypes).toEqual([
      "policy.draft_created",
      "policy.draft_updated",
      "policy.published",
      "policy.draft_created",
      "policy.published",
    ]);
    expect(logs).toHaveLength(5);
  });

  it("audit payloads contain tenantId but NOT content (D-37 by-reference)", async () => {
    const { policyService, auditRepo } = setupPolicy(alwaysValidValidator());
    const policy = await policyService.createPolicy(TENANT_A, { name: "D-37 Test" });
    const draft = await policyService.createDraft(TENANT_A, policy.id, { sensitiveData: true }, ACTOR);
    await policyService.publishDraft(TENANT_A, draft.id);

    const logs = await auditRepo.findByTenant(TENANT_A);
    for (const log of logs) {
      const payload = log.payload as Record<string, unknown>;
      // By-reference fields present
      expect(payload.tenantId).toBe(TENANT_A.tenantId);
      expect(payload.policyId).toBe(policy.id);
      expect(payload.actorId).toBe(ACTOR);
      // Content MUST NOT be present (D-37)
      expect(payload).not.toHaveProperty("content");
    }
  });

  it("audit records scoped by tenant", async () => {
    const { policyService, auditRepo } = setupPolicy(alwaysValidValidator());
    const policy = await policyService.createPolicy(TENANT_A, { name: "Scoped" });
    await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

    const logs = await auditRepo.findByTenant(TENANT_A);
    for (const log of logs) {
      expect(log.tenantId).toBe(TENANT_A.tenantId);
    }
  });
});
