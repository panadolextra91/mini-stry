import type { PolicyId, PolicyVersionId } from "../domain/ids.js";
import type { ValidationError } from "@/modules/runtime/index.js";

export class PolicyNotFoundError extends Error {
  constructor(public readonly policyId: PolicyId) {
    super(`Policy ${policyId} not found in this tenant`);
    this.name = "PolicyNotFoundError";
  }
}

export class DraftNotFoundError extends Error {
  constructor(public readonly versionId: PolicyVersionId) {
    super(`Draft version ${versionId} not found`);
    this.name = "DraftNotFoundError";
  }
}

export class VersionNotFoundError extends Error {
  constructor(public readonly versionId: PolicyVersionId) {
    super(`Policy version ${versionId} not found`);
    this.name = "VersionNotFoundError";
  }
}

export class ImmutableVersionError extends Error {
  constructor(public readonly versionId: PolicyVersionId) {
    super(`Policy version ${versionId} is published and immutable`);
    this.name = "ImmutableVersionError";
  }
}

export class InvalidPublishError extends Error {
  constructor(
    public readonly versionId: PolicyVersionId,
    public readonly validationErrors: readonly ValidationError[],
  ) {
    super(
      `Cannot publish version ${versionId}: content has ${validationErrors.length} validation error(s)`,
    );
    this.name = "InvalidPublishError";
  }
}

export class ConflictError extends Error {
  constructor(
    public readonly versionId: PolicyVersionId,
    public readonly expectedRevision: number,
    public readonly actualRevision: number,
  ) {
    super(
      `Concurrency conflict on version ${versionId}: expected revision ${expectedRevision}, actual ${actualRevision}`,
    );
    this.name = "ConflictError";
  }
}

export class DraftAlreadyExistsError extends Error {
  constructor(public readonly policyId: PolicyId) {
    super(`Policy ${policyId} already has an active draft — publish or discard it first`);
    this.name = "DraftAlreadyExistsError";
  }
}

export class RequestTypeAlreadyExistsError extends Error {
  constructor(public readonly requestType: string) {
    super(`A policy with requestType "${requestType}" already exists in this tenant`);
    this.name = "RequestTypeAlreadyExistsError";
  }
}
