import { describe, it, expect } from "vitest";
import { autoApprove, autoReject, requestApproval } from "@/modules/runtime/index.js";
import { roleId } from "@/modules/directory/index.js";
import type { Decision } from "@/modules/runtime/index.js";

describe("Decision factories", () => {
  it("autoApprove()", () => {
    const d = autoApprove();
    expect(d.kind).toBe("auto-approve");
    expect(Object.keys(d)).toEqual(["kind"]);

    // Distinct instances
    const d2 = autoApprove();
    expect(d).not.toBe(d2);
    expect(d).toEqual(d2);
  });

  it("autoReject()", () => {
    const d = autoReject();
    expect(d.kind).toBe("auto-reject");
    expect(Object.keys(d)).toEqual(["kind"]);

    const d2 = autoReject();
    expect(d).not.toBe(d2);
    expect(d).toEqual(d2);
  });

  it("requestApproval()", () => {
    const d = requestApproval(roleId("ROLE-X"));
    expect(d.kind).toBe("request-approval");
    expect((d as { targetRoleId: string }).targetRoleId).toBe("ROLE-X");
    expect(Object.keys(d).sort()).toEqual(["kind", "targetRoleId"].sort());

    const d2 = requestApproval(roleId("ROLE-X"));
    expect(d).not.toBe(d2);
    expect(d).toEqual(d2);
  });

  it("exhaustiveness check", () => {
    // @ts-expect-error D-29 union is closed in v1
    const d: Decision = { kind: "escalate" };
    void d;
  });
});
