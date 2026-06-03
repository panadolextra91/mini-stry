export class PolicyNotFoundForRequestType extends Error {
  constructor(public readonly requestType: string) {
    super(`No policy found for requestType "${requestType}" in this tenant`);
    this.name = "PolicyNotFoundForRequestType";
  }
}

export class NoActivePolicyError extends Error {
  constructor(public readonly requestType: string) {
    super(`Policy for requestType "${requestType}" has no active version`);
    this.name = "NoActivePolicyError";
  }
}
