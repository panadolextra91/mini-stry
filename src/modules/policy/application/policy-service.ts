import type { PolicyId, PolicyVersionId } from "../domain/ids.js";
import type { Policy } from "../domain/policy.js";
import type { PolicyVersion } from "../domain/policy-version.js";
import type { PolicyEventMap } from "../domain/policy-events.js";
import type { PolicyRepositoryPort } from "../ports/policy-repository.port.js";
import type { PolicyVersionRepositoryPort } from "../ports/policy-version-repository.port.js";
import type { SchemaValidatorPort } from "@/modules/runtime/index.js";
import type { TenantContext, UserId } from "@/modules/directory/index.js";
import type { EventDispatcher } from "@/shared/event-dispatcher.js";
import {
  DraftAlreadyExistsError,
  DraftNotFoundError,
  ImmutableVersionError,
  InvalidPublishError,
  ConflictError,
} from "./errors.js";

export class PolicyService {
  constructor(
    private readonly policyRepo: PolicyRepositoryPort,
    private readonly versionRepo: PolicyVersionRepositoryPort,
    private readonly validator: SchemaValidatorPort,
    private readonly dispatcher: EventDispatcher<PolicyEventMap>,
  ) {}

  async createPolicy(
    ctx: TenantContext,
    input: { name: string },
  ): Promise<Policy> {
    return this.policyRepo.create(ctx, input);
  }

  async createDraft(
    ctx: TenantContext,
    policyId: PolicyId,
    content: unknown,
    createdBy: UserId,
  ): Promise<PolicyVersion> {
    // D-32: one draft per policy
    const existingDraft = await this.versionRepo.findDraftByPolicy(
      ctx,
      policyId,
    );
    if (existingDraft) {
      throw new DraftAlreadyExistsError(policyId);
    }

    const versionNumber = await this.versionRepo.getNextVersionNumber(
      ctx,
      policyId,
    );

    // D-34: validation runs on every save but does not gate storage
    const result = this.validator.validate(content);
    const validationStatus = result.ok ? ("valid" as const) : ("invalid" as const);
    const validationErrors = result.ok ? [] : [...result.errors];

    const draft = await this.versionRepo.create(ctx, {
      policyId,
      content,
      createdBy,
      rollbackFromVersionId: null,
      versionNumber,
      validationStatus,
      validationErrors,
    });

    await this.dispatcher.emit("DraftCreated", {
      tenantId: ctx.tenantId,
      policyId,
      policyVersionId: draft.id,
      versionNumber: draft.versionNumber,
      actorId: createdBy,
      rollbackFromVersionId: null,
      timestamp: Date.now(),
    });

    return draft;
  }

  async saveDraft(
    ctx: TenantContext,
    versionId: PolicyVersionId,
    content: unknown,
    expectedRevision: number,
  ): Promise<PolicyVersion> {
    const version = await this.versionRepo.findById(ctx, versionId);
    if (!version) {
      throw new DraftNotFoundError(versionId);
    }
    // POL-03: immutability
    if (version.status === "published") {
      throw new ImmutableVersionError(versionId);
    }
    // D-36: optimistic concurrency
    if (version.revision !== expectedRevision) {
      throw new ConflictError(versionId, expectedRevision, version.revision);
    }

    // D-34: validation runs on every save
    const result = this.validator.validate(content);
    const validationStatus = result.ok ? ("valid" as const) : ("invalid" as const);
    const validationErrors = result.ok ? [] : [...result.errors];

    const updated = await this.versionRepo.update(ctx, versionId, {
      content,
      validationStatus,
      validationErrors,
      revision: version.revision + 1,
    });

    await this.dispatcher.emit("DraftUpdated", {
      tenantId: ctx.tenantId,
      policyId: version.policyId,
      policyVersionId: versionId,
      versionNumber: version.versionNumber,
      actorId: version.createdBy,
      timestamp: Date.now(),
    });

    return updated;
  }

  async publishDraft(
    ctx: TenantContext,
    versionId: PolicyVersionId,
  ): Promise<PolicyVersion> {
    const version = await this.versionRepo.findById(ctx, versionId);
    if (!version) {
      throw new DraftNotFoundError(versionId);
    }
    // POL-03: immutability — cannot re-publish
    if (version.status === "published") {
      throw new ImmutableVersionError(versionId);
    }
    // D-34: publish gate — must be valid
    if (version.validationStatus !== "valid") {
      throw new InvalidPublishError(versionId, version.validationErrors);
    }

    const publishedAt = Date.now();
    const published = await this.versionRepo.update(ctx, versionId, {
      status: "published",
      publishedAt,
      revision: version.revision,
    });

    await this.policyRepo.updateActiveVersion(
      ctx,
      version.policyId,
      versionId,
    );

    await this.dispatcher.emit("PolicyPublished", {
      tenantId: ctx.tenantId,
      policyId: version.policyId,
      policyVersionId: versionId,
      versionNumber: version.versionNumber,
      actorId: version.createdBy,
      timestamp: publishedAt,
    });

    return published;
  }
}
