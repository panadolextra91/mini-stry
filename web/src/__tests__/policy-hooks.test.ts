import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock convex/react before importing hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

// Mock DemoContext
const mockUseDemoContext = vi.fn();
vi.mock("../app/context/DemoContext", () => ({
  useDemoContext: () => mockUseDemoContext(),
}));

// Mock convex API - must come after convex/react mock
vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    policy: {
      listPolicies: "listPolicies",
      listVersions: "listVersions",
      createDraft: "createDraft",
      saveDraft: "saveDraft",
      publish: "publish",
      rollback: "rollback",
    },
  },
}));

import { renderHook } from "@testing-library/react";
import { useCreateDraft, useSaveDraft, usePublish, useRollback } from "../features/policy/policy-hooks";

describe("policy-hooks context-injection guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useCreateDraft throws 'Missing context' when tenantId is null", async () => {
    mockUseDemoContext.mockReturnValue({ tenantId: null, actorId: null });
    const { result } = renderHook(() => useCreateDraft());
    await expect(result.current("policyId", {})).rejects.toThrow("Missing context");
  });

  it("useSaveDraft throws 'Missing context' when tenantId is null", async () => {
    mockUseDemoContext.mockReturnValue({ tenantId: null, actorId: null });
    const { result } = renderHook(() => useSaveDraft());
    await expect(result.current("versionId", {}, 1)).rejects.toThrow("Missing context");
  });

  it("usePublish throws 'Missing context' when tenantId is null", async () => {
    mockUseDemoContext.mockReturnValue({ tenantId: null, actorId: null });
    const { result } = renderHook(() => usePublish());
    await expect(result.current("versionId")).rejects.toThrow("Missing context");
  });

  it("useRollback throws 'Missing context' when tenantId is null", async () => {
    mockUseDemoContext.mockReturnValue({ tenantId: null, actorId: null });
    const { result } = renderHook(() => useRollback());
    await expect(result.current("policyId", "versionId")).rejects.toThrow("Missing context");
  });
});
