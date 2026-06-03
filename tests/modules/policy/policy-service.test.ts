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
  RequestTypeAlreadyExistsError,
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
    it("creates a policy with name, requestType, and null activeVersionId", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Travel Policy", requestType: "travel_request" });

      expect(policy.name).toBe("Travel Policy");
      expect(policy.requestType).toBe("travel_request");
      expect(policy.tenantId).toBe(TENANT_A.tenantId);
      expect(policy.activeVersionId).toBeNull();
      expect(policy.id).toBeDefined();
    });
  });

  describe("createDraft", () => {
    it("creates a draft version with validation on save", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Draft Test", requestType: "draft_test" });
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
      const policy = await policyService.createPolicy(TENANT_A, { name: "Invalid Draft", requestType: "invalid_draft" });

      const draft = await policyService.createDraft(TENANT_A, policy.id, { bad: true }, ACTOR);

      expect(draft.status).toBe("draft");
      expect(draft.validationStatus).toBe("invalid");
      expect(draft.validationErrors).toHaveLength(1);
    });

    it("throws DraftAlreadyExistsError when a draft already exists", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Dup Draft", requestType: "dup_draft" });
      await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

      await expect(
        policyService.createDraft(TENANT_A, policy.id, {}, ACTOR),
      ).rejects.toThrow(DraftAlreadyExistsError);
    });

    it("emits DraftCreated event", async () => {
      const { policyService, dispatcher } = setupPolicy(alwaysValidValidator());
      const handler = vi.fn();
      dispatcher.on("DraftCreated", handler);
      const policy = await policyService.createPolicy(TENANT_A, { name: "Event Test", requestType: "event_test" });

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
      const policy = await policyService.createPolicy(TENANT_A, { name: "Save Test", requestType: "save_test" });
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
      const policy = await policyService.createPolicy(TENANT_A, { name: "Val Save", requestType: "val_save" });
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
      const policy = await policyService.createPolicy(TENANT_A, { name: "Immutable Test", requestType: "immutable_test" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);
      await policyService.publishDraft(TENANT_A, draft.id);

      await expect(
        policyService.saveDraft(TENANT_A, draft.id, {}, 0),
      ).rejects.toThrow(ImmutableVersionError);
    });

    it("throws ConflictError on revision mismatch", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Conflict Test", requestType: "conflict_test" });
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
      const policy = await policyService.createPolicy(TENANT_A, { name: "Update Event", requestType: "update_event" });
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
      const policy = await policyService.createPolicy(TENANT_A, { name: "Publish Test", requestType: "publish_test" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

      const published = await policyService.publishDraft(TENANT_A, draft.id);

      expect(published.status).toBe("published");
      expect(published.publishedAt).not.toBeNull();

      const updatedPolicy = await policyRepo.findById(TENANT_A, policy.id);
      expect(updatedPolicy!.activeVersionId).toBe(draft.id);
    });

    it("throws InvalidPublishError when validation status is invalid", async () => {
      const { policyService } = setupPolicy(alwaysInvalidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Invalid Publish", requestType: "invalid_publish" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

      await expect(
        policyService.publishDraft(TENANT_A, draft.id),
      ).rejects.toThrow(InvalidPublishError);
    });

    it("throws ImmutableVersionError when re-publishing", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Re-Publish", requestType: "re_publish" });
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
      const policy = await policyService.createPolicy(TENANT_A, { name: "Publish Event", requestType: "publish_event" });
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
      const policy = await policyService.createPolicy(TENANT_A, { name: "Rollback Test", requestType: "rollback_test" });

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
      const policy = await policyService.createPolicy(TENANT_A, { name: "Rollback Publish", requestType: "rollback_publish" });

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
      const policy = await policyService.createPolicy(TENANT_A, { name: "Version Numbers", requestType: "version_numbers" });

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
      const policy = await policyService.createPolicy(TENANT_A, { name: "Dup Rollback", requestType: "dup_rollback" });

      const v1 = await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);
      await policyService.publishDraft(TENANT_A, v1.id);

      await policyService.createDraft(TENANT_A, policy.id, {}, ACTOR);

      await expect(
        policyService.rollback(TENANT_A, policy.id, v1.id, ACTOR),
      ).rejects.toThrow(DraftAlreadyExistsError);
    });

    it("throws VersionNotFoundError for missing target", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Missing Target", requestType: "missing_target" });

      await expect(
        policyService.rollback(TENANT_A, policy.id, policyVersionId("nope"), ACTOR),
      ).rejects.toThrow(VersionNotFoundError);
    });

    it("emits DraftCreated event with rollbackFromVersionId", async () => {
      const { policyService, dispatcher } = setupPolicy(alwaysValidValidator());
      const handler = vi.fn();
      dispatcher.on("DraftCreated", handler);
      const policy = await policyService.createPolicy(TENANT_A, { name: "Rollback Event", requestType: "rollback_event" });

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
      const policy = await policyService.createPolicy(TENANT_A, { name: "Clone Validation", requestType: "clone_validation" });

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
      const policy = await policyService.createPolicy(TENANT_A, { name: "No Active", requestType: "no_active" });

      const active = await policyService.getActiveVersion(TENANT_A, policy.id);
      expect(active).toBeNull();
    });

    it("returns active version after publish", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "Active Test", requestType: "active_test" });
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
      const policy = await policyService.createPolicy(TENANT_A, { name: "Isolated", requestType: "isolated" });
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

      const policy = await policyService.createPolicy(TENANT_A, { name: "Full Lifecycle", requestType: "full_lifecycle" });
      const draft = await policyService.createDraft(TENANT_A, policy.id, { rules: [] }, ACTOR);
      await policyService.saveDraft(TENANT_A, draft.id, { rules: [{ id: "r1" }] }, 0);
      const published = await policyService.publishDraft(TENANT_A, draft.id);

      expect(published.status).toBe("published");
      expect(events).toEqual(["DraftCreated", "DraftUpdated", "PolicyPublished"]);
    });
  });

  describe("requestType", () => {
    it("persists requestType on created policy", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const policy = await policyService.createPolicy(TENANT_A, { name: "RT Policy", requestType: "leave_request" });

      expect(policy.requestType).toBe("leave_request");
    });

    it("throws RequestTypeAlreadyExistsError on duplicate [tenantId, requestType]", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      await policyService.createPolicy(TENANT_A, { name: "First", requestType: "expense_request" });

      await expect(
        policyService.createPolicy(TENANT_A, { name: "Second", requestType: "expense_request" }),
      ).rejects.toThrow(RequestTypeAlreadyExistsError);
    });

    it("allows same requestType under different tenants (CON-01)", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      await policyService.createPolicy(TENANT_A, { name: "A", requestType: "shared_type" });

      const policyB = await policyService.createPolicy(TENANT_B, { name: "B", requestType: "shared_type" });
      expect(policyB.requestType).toBe("shared_type");
      expect(policyB.tenantId).toBe(TENANT_B.tenantId);
    });

    it("findByRequestType returns matching tenant-scoped policy", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());
      const created = await policyService.createPolicy(TENANT_A, { name: "Find Test", requestType: "find_type" });

      const found = await policyService.findByRequestType(TENANT_A, "find_type");
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it("findByRequestType returns null for unknown requestType", async () => {
      const { policyService } = setupPolicy(alwaysValidValidator());

      const found = await policyService.findByRequestType(TENANT_A, "nonexistent");
      expect(found).toBeNull();
    });
  });
});
