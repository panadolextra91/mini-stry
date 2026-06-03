import type { UserId, RoleId } from "../domain/ids.js";

export class RoleNameAlreadyExistsError extends Error {
  constructor(name: string) {
    super(`Role name "${name}" already exists in this tenant`);
    this.name = "RoleNameAlreadyExistsError";
  }
}

export class EmailAlreadyExistsError extends Error {
  constructor(public readonly email: string) {
    super(`User email "${email}" already exists in this tenant`);
    this.name = "EmailAlreadyExistsError";
  }
}

export class RoleNotFoundError extends Error {
  constructor(public readonly id: RoleId) {
    super(`Role ${id} not found in this tenant`);
    this.name = "RoleNotFoundError";
  }
}

export class UserNotFoundError extends Error {
  constructor(public readonly id: UserId) {
    super(`User ${id} not found in this tenant`);
    this.name = "UserNotFoundError";
  }
}

export class ManagerNotFoundError extends Error {
  constructor(public readonly id: UserId) {
    super(`Manager ${id} not found in this tenant`);
    this.name = "ManagerNotFoundError";
  }
}

export class ManagerCycleError extends Error {
  constructor(
    public readonly userId: UserId,
    public readonly managerId: UserId,
  ) {
    super(`Assigning ${managerId} as manager of ${userId} would create a cycle`);
    this.name = "ManagerCycleError";
  }
}
