import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupPolicy } from "../../_helpers/in-memory-fakes.js";
import { TENANT_A, TENANT_B } from "../../_helpers/tenant-context-fixture.js";
import type { SchemaValidatorPort, ValidationResult } from "@/modules/runtime/index.js";
import { ValidationError } from "@/modules/runtime/index.js";
import {
  DraftAlreadyExistsError,
  DraftNotFoundError,
  ImmutableVersionError,
  InvalidPublishError,
  ConflictError,
} from "@/modules/policy/index.js";
import type { PolicyEventMap } from "@/modules/policy/index.js";
import { userId } from "@/modules/directory/index.js";

const ACTOR = userId("user_actor");

function alwaysValidValidator(): SchemaValidatorPort {
  return {
    validate: () => ({ ok: true, value: {} } as ValidationResult),
  };
}

function alwaysInvalidValidator(msg = "invalid field"): SchemaValidatorPort {
  return {
    validate: () => ({
      ok: false,
      errors: [new ValidationError("INVALID", "/rules", msg)],
    } as ValidationResult),
  };
}

describe("PolicyService", () => {
  describe("createPolicy", () => {
    it("creates a policy with name and null activeVersionId", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Travel Policy" });

      expect(policy.name).toBe("Travel Policy");
      expect(policy.tenantId).toBe(TENANT_A.tenantId);
      expect(policy.activeVersionId).toBeNull();
      expect(policy.id).toBeDefined();
    });
  });

  describe("createDraft", () => {
    it("creates a draft version with validation on save", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Draft Test" });
      const content = { rules: [] };

      const draft = await policyService.createDraft(TENANT_A, policy.id, content, ACTOR);

      expect(draft.status).toBe("draft");
      expect(draft.versionNumber).toBe(1);
      expect(draft.validationStatus).toBe("valid");
      expect(draft.validationErrors).toEqual([]);
      expect(draft.revision).toBe(0);
      expect(draft.rollbackFromVersionId).toBeNull();
      expect(draft.createdBy).toBe(ACTOR);
      expect(draft.publishedAt).toBeNull();
    });

    it("stores validation errors when content is invalid", async () => {
      const { policyService } = setupPolicy(alwaysInvalidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Invalid Draft" });

      const draft = await policyService.createDraft(TENANT_A, policy.id, { bad: true }, ACTOR);

      expect(draft.status).toBe("draft");
      expect(draft.validationStatus).toBe("invalid");
      expect(draft.validationErrors).toHaveLength(1);
    });

    it("throws DraftAlreadyExistsError when a draft already exists", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Dup Draft" });
      await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

      await expect(
        policyService.createDraft(TENANT_A, policy.id, {}, ACTOR),
      ).rejects.toThrow(DraftAlreadyExistsError);
    });

    it("emits DraftCreated event", async () => {
      const { policyService, dispatcher } = setupPolicy(alwaysValidValidator());
      const handler = vi.fn();
      dispatcher.on("DraftCreated", handler);
      const policy = await policyService.createPolicy(TENANT_A, { name: "Event Test" });

      await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0]).toMatchObject({
        policyId: policy.id,
        actorId: ACTOR,
        rollbackFromVersionId: null,
      });
    });
  });

  describe("saveDraft", () => {
    it("saves draft with new content and increments revision", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Save Test" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

      const saved = await policyService.saveDraft(
        TENANT_A,
        draft.id,
        { rules: [{ id: "r1" }] },
        0,
      );

      expect(saved.revision).toBe(1);
      expect(saved.content).toEqual({ rules: [{ id: "r1" }] });
    });

    it("runs validation on every save", async () => {
      const validator = alwaysInvalidValidator("bad field");
      const { policyService } = setupPolicy(validator);
      const policy = await policyService.createPolicy(TENANT_A, { name: "Val Save" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

      const saved = await policyService.saveDraft(TENANT_A, draft.id, { bad: true }, 0);

      expect(saved.validationStatus).toBe("invalid");
      expect(saved.validationErrors.length).toBeGreaterThan(0);
    });

    it("throws DraftNotFoundError for nonexistent version", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const { policyVersionId } = await import("@/modules/policy/index.js");

      await expect(
        policyService.saveDraft(TENANT_A, policyVersionId("nope"), {}, 0),
      ).rejects.toThrow(DraftNotFoundError);
    });

    it("throws ImmutableVersionError when saving published version", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Immutable Test" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);
      await policyService.publishDraft(TENANT_A, draft.id);

      await expect(
        policyService.saveDraft(TENANT_A, draft.id, {}, 0),
      ).rejects.toThrow(ImmutableVersionError);
    });

    it("throws ConflictError on revision mismatch", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Conflict Test" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

      // Save once to increment revision to 1
      await policyService.saveDraft(TENANT_A, draft.id, { v: 1 }, 0);

      // Now try with stale revision
      await expect(
        policyService.saveDraft(TENANT_A, draft.id, { v: 2 }, 0),
      ).rejects.toThrow(ConflictError);
    });

    it("emits DraftUpdated event", async () => {
      const { policyService, dispatcher } = setupPolicy(alwaysValidValidator());
      const handler = vi.fn();
      dispatcher.on("DraftUpdated", handler);
      const policy = await policyService.createPolicy(TENANT_A, { name: "Update Event" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

      await policyService.saveDraft(TENANT_A, draft.id, { x: 1 }, 0);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0]).toMatchObject({
        policyId: policy.id,
        policyVersionId: draft.id,
      });
    });
  });

  describe("publishDraft", () => {
    it("publishes valid draft and updates activeVersionId", async () => {
      const { policyService, policyRepo } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Publish Test" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

      const published = await policyService.publishDraft(TENANT_A, draft.id);

      expect(published.status).toBe("published");
      expect(published.publishedAt).toBeDefined();
      expect(published.publishedAt).not.toBeNull();

      const updatedPolicy = await policyRepo.findById(TENANT_A, policy.id);
      expect(updatedPolicy!.activeVersionId).toBe(draft.id);
    });

    it("throws InvalidPublishError when validation status is invalid", async () => {
      const { policyService } = setupPolicy(alwaysInvalidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Invalid Publish" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

      await expect(
        policyService.publishDraft(TENANT_A, draft.id),
      ).rejects.toThrow(InvalidPublishError);
    });

    it("throws ImmutableVersionError when re-publishing", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Re-Publish" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);
      await policyService.publishDraft(TENANT_A, draft.id);

      await expect(
        policyService.publishDraft(TENANT_A, draft.id),
      ).rejects.toThrow(ImmutableVersionError);
    });

    it("throws DraftNotFoundError for nonexistent version", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const { policyVersionId } = await import("@/modules/policy/index.js");

      await expect(
        policyService.publishDraft(TENANT_A, policyVersionId("missing")),
      ).rejects.toThrow(DraftNotFoundError);
    });

    it("emits PolicyPublished event", async () => {
      const { policyService, dispatcher } = setupPolicy(alwaysValidValidator());
      const handler = vi.fn();
      dispatcher.on("PolicyPublished", handler);
      const policy = await policyService.createPolicy(TENANT_A, { name: "Publish Event" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

      await policyService.publishDraft(TENANT_A, draft.id);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0]).toMatchObject({
        policyId: policy.id,
        policyVersionId: draft.id,
        actorId: ACTOR,
      });
    });
  });

  describe("tenant isolation", () => {
    it("tenant B cannot access tenant A's draft", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Isolated" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

      // Tenant B trying to save tenant A's draft should fail
      await expect(
        policyService.saveDraft(TENANT_B, draft.id, {}, 0),
      ).rejects.toThrow(DraftNotFoundError);
    });
  });

  describe("full lifecycle", () => {
    it("create → draft → save → publish", async () => {
      const { policyService, dispatcher } = setupPolicy(alwaysValidValidator());
      const events: string[] = [];
      dispatcher.on("DraftCreated", () => events.push("DraftCreated"));
      dispatcher.on("DraftUpdated", () => events.push("DraftUpdated"));
      dispatcher.on("PolicyPublished", () => events.push("PolicyPublished"));

      const policy = await policyService.createPolicy(TENANT_A, { name: "Full Lifecycle" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, { rules: [] }, ACTOR);
      await policyService.saveDraft(TENANT_A, draft.id, { rules: [{ id: "r1" }] }, 0);
      const published = await policyService.publishDraft(TENANT_A, draft.id);

      expect(published.status).toBe("published");
      expect(events).toEqual(["DraftCreated", "DraftUpdated", "PolicyPublished"]);
    });
  });
});
