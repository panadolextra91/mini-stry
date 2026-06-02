import { describe, it, expect, vi } from "vitest";
import { setupPolicy } from "../../_helpers/in-memory-fakes.js";
import { TENANT_A, TENANT_B } from "../../_helpers/tenant-context-fixture.js";
import type { SchemaValidatorPort, ValidationResult } from "@/modules/runtime/index.js";
import { ValidationError } from "@/modules/runtime/index.js";
import {
  DraftAlreadyExistsError,
  DraftNotFoundError,
  VersionNotFoundError,
  ImmutableVersionError,
  InvalidPublishError,
  ConflictError,
  policyVersionId,
} from "@/modules/policy/index.js";
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
      expect(handler.mock.calls[0]![0]).toMatchObject({
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

      await policyService.saveDraft(TENANT_A, draft.id, { v: 1 }, 0);

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
      expect(handler.mock.calls[0]![0]).toMatchObject({
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
      expect(handler.mock.calls[0]![0]).toMatchObject({
        policyId: policy.id,
        policyVersionId: draft.id,
        actorId: ACTOR,
      });
    });
  });

  describe("rollback", () => {
    it("creates forward clone with content from target version", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Rollback Test" });

      const v1 = await policyService.createDraft(TENANT_A, policy.id, { rules: [{ id: "original" }] }, ACTOR);
      await policyService.publishDraft(TENANT_A, v1.id);

      const v2 = await policyService.createDraft(TENANT_A, policy.id, { rules: [{ id: "updated" }] }, ACTOR);
      await policyService.publishDraft(TENANT_A, v2.id);

      const v3 = await policyService.rollback(TENANT_A, policy.id, v1.id, ACTOR);

      expect(v3.versionNumber).toBe(3);
      expect(v3.content).toEqual({ rules: [{ id: "original" }] });
      expect(v3.rollbackFromVersionId).toBe(v1.id);
      expect(v3.status).toBe("draft");
    });

    it("rollback draft can be published, updating activeVersionId", async () => {
      const { policyService, policyRepo } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Rollback Publish" });

      const v1 = await policyService.createDraft(TENANT_A, policy.id, { v: 1 }, ACTOR);
      await policyService.publishDraft(TENANT_A, v1.id);

      const v2 = await policyService.createDraft(TENANT_A, policy.id, { v: 2 }, ACTOR);
      await policyService.publishDraft(TENANT_A, v2.id);

      const v3 = await policyService.rollback(TENANT_A, policy.id, v1.id, ACTOR);
      const published = await policyService.publishDraft(TENANT_A, v3.id);

      expect(published.status).toBe("published");
      const updatedPolicy = await policyRepo.findById(TENANT_A, policy.id);
      expect(updatedPolicy!.activeVersionId).toBe(v3.id);
    });

    it("version numbers strictly increase", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Version Numbers" });

      const v1 = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);
      expect(v1.versionNumber).toBe(1);
      await policyService.publishDraft(TENANT_A, v1.id);

      const v2 = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);
      expect(v2.versionNumber).toBe(2);
      await policyService.publishDraft(TENANT_A, v2.id);

      const v3 = await policyService.rollback(TENANT_A, policy.id, v1.id, ACTOR);
      expect(v3.versionNumber).toBe(3);
    });

    it("throws DraftAlreadyExistsError when draft exists", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Dup Rollback" });

      const v1 = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);
      await policyService.publishDraft(TENANT_A, v1.id);

      await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

      await expect(
        policyService.rollback(TENANT_A, policy.id, v1.id, ACTOR),
      ).rejects.toThrow(DraftAlreadyExistsError);
    });

    it("throws VersionNotFoundError for missing target", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Missing Target" });

      await expect(
        policyService.rollback(TENANT_A, policy.id, policyVersionId("nope"), ACTOR),
      ).rejects.toThrow(VersionNotFoundError);
    });

    it("emits DraftCreated event with rollbackFromVersionId", async () => {
      const { policyService, dispatcher } = setupPolicy(alwaysValidValidator());
      const handler = vi.fn();
      dispatcher.on("DraftCreated", handler);
      const policy = await policyService.createPolicy(TENANT_A, { name: "Rollback Event" });

      const v1 = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);
      await policyService.publishDraft(TENANT_A, v1.id);

      handler.mockClear();
      await policyService.rollback(TENANT_A, policy.id, v1.id, ACTOR);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0]![0]).toMatchObject({
        policyId: policy.id,
        rollbackFromVersionId: v1.id,
      });
    });

    it("clones validationStatus from source (no re-validation)", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Clone Validation" });

      const v1 = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);
      await policyService.publishDraft(TENANT_A, v1.id);

      const rollbackDraft = await policyService.rollback(TENANT_A, policy.id, v1.id, ACTOR);

      expect(rollbackDraft.validationStatus).toBe("valid");
      expect(rollbackDraft.validationErrors).toEqual([]);
    });
  });

  describe("getActiveVersion", () => {
    it("returns null when no version published", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "No Active" });

      const active = await policyService.getActiveVersion(TENANT_A, policy.id);
      expect(active).toBeNull();
    });

    it("returns active version after publish", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Active Test" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);
      await policyService.publishDraft(TENANT_A, draft.id);

      const active = await policyService.getActiveVersion(TENANT_A, policy.id);
      expect(active).not.toBeNull();
      expect(active!.id).toBe(draft.id);
      expect(active!.status).toBe("published");
    });
  });

  describe("tenant isolation", () => {
    it("tenant B cannot access tenant A's draft", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Isolated" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

      await expect(
        policyService.saveDraft(TENANT_B, draft.id, {}, 0),
      ).rejects.toThrow(DraftNotFoundError);
    });
  });

  describe("full lifecycle", () => {
    it("create → draft → save → publish", async () => {
      const { policyService, dispatcher } = setupPolicy(alwaysValidValidator());
      const events: string[] = [];
      dispatcher.on("DraftCreated", () => { events.push("DraftCreated"); });
      dispatcher.on("DraftUpdated", () => { events.push("DraftUpdated"); });
      dispatcher.on("PolicyPublished", () => { events.push("PolicyPublished"); });

      const policy = await policyService.createPolicy(TENANT_A, { name: "Full Lifecycle" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, { rules: [] }, ACTOR);
      await policyService.saveDraft(TENANT_A, draft.id, { rules: [{ id: "r1" }] }, 0);
      const published = await policyService.publishDraft(TENANT_A, draft.id);

      expect(published.status).toBe("published");
      expect(events).toEqual(["DraftCreated", "DraftUpdated", "PolicyPublished"]);
    });
  });
});
