import { describe, it, expect } from "vitest";
import {
  transitionTask,
  deriveChainStatus,
  InvalidTaskTransitionError,
} from "@/modules/approval/domain/state-machine.js";

describe("state-machine", () => {
  describe("transitionTask", () => {
    it("transitions PENDING with APPROVE to APPROVED", () => {
      expect(transitionTask("PENDING", "APPROVE")).toBe("APPROVED");
    });

    it("transitions PENDING with REJECT to REJECTED", () => {
      expect(transitionTask("PENDING", "REJECT")).toBe("REJECTED");
    });

    it("throws InvalidTaskTransitionError on transitioning APPROVED", () => {
      expect(() => transitionTask("APPROVED", "APPROVE")).toThrow(InvalidTaskTransitionError);
      expect(() => transitionTask("APPROVED", "REJECT")).toThrow(InvalidTaskTransitionError);
    });

    it("throws InvalidTaskTransitionError on transitioning REJECTED", () => {
      expect(() => transitionTask("REJECTED", "APPROVE")).toThrow(InvalidTaskTransitionError);
      expect(() => transitionTask("REJECTED", "REJECT")).toThrow(InvalidTaskTransitionError);
    });
  });

  describe("deriveChainStatus", () => {
    it("returns APPROVED when all tasks are APPROVED", () => {
      expect(deriveChainStatus(["APPROVED"])).toBe("APPROVED");
      expect(deriveChainStatus(["APPROVED", "APPROVED"])).toBe("APPROVED");
    });

    it("returns REJECTED if any task is REJECTED", () => {
      expect(deriveChainStatus(["REJECTED"])).toBe("REJECTED");
      expect(deriveChainStatus(["APPROVED", "REJECTED"])).toBe("REJECTED");
      expect(deriveChainStatus(["PENDING", "REJECTED"])).toBe("REJECTED");
      expect(deriveChainStatus(["APPROVED", "PENDING", "REJECTED"])).toBe("REJECTED");
    });

    it("returns IN_PROGRESS when there is a PENDING task and no REJECTED tasks", () => {
      expect(deriveChainStatus(["PENDING"])).toBe("IN_PROGRESS");
      expect(deriveChainStatus(["APPROVED", "PENDING"])).toBe("IN_PROGRESS");
    });

    it("returns IN_PROGRESS for an empty array of task states", () => {
      expect(deriveChainStatus([])).toBe("IN_PROGRESS");
    });
  });
});
