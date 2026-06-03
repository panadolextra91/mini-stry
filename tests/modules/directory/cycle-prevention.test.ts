import { describe, it, expect, beforeEach } from "vitest";
import { setupDirectory } from "../../_helpers/in-memory-fakes.js";
import { TENANT_A } from "../../_helpers/tenant-context-fixture.js";
import {
  ManagerCycleError,
  ManagerNotFoundError,
  UserId,
  userId,
} from "@/modules/directory/index.js";

describe("UserService.setManager Cycle Prevention", () => {
  let { roleService, userService, userRepo } = setupDirectory();

  beforeEach(() => {
    const fakes = setupDirectory();
    roleService = fakes.roleService;
    userService = fakes.userService;
    userRepo = fakes.userRepo;
  });

  it("rejects direct self-loop", async () => {
    const role = await roleService.createRole(TENANT_A, { name: "admin" });
    const u = await userService.createUser(TENANT_A, {
      email: "u@u.com",
      name: "u",
      roleId: role.id,
      managerId: null,
    });
    await expect(userService.setManager(TENANT_A, u.id, u.id)).rejects.toThrow(ManagerCycleError);
  });

  it("rejects 2-cycle", async () => {
    const role = await roleService.createRole(TENANT_A, { name: "admin" });
    const a = await userService.createUser(TENANT_A, {
      email: "a@a.com",
      name: "a",
      roleId: role.id,
      managerId: null,
    });
    const b = await userService.createUser(TENANT_A, {
      email: "b@b.com",
      name: "b",
      roleId: role.id,
      managerId: null,
    });

    await userService.setManager(TENANT_A, a.id, b.id);
    await expect(userService.setManager(TENANT_A, b.id, a.id)).rejects.toThrow(ManagerCycleError);
  });

  it("rejects N-cycle", async () => {
    const role = await roleService.createRole(TENANT_A, { name: "admin" });
    const a = await userService.createUser(TENANT_A, {
      email: "a@a.com",
      name: "a",
      roleId: role.id,
      managerId: null,
    });
    const b = await userService.createUser(TENANT_A, {
      email: "b@b.com",
      name: "b",
      roleId: role.id,
      managerId: null,
    });
    const c = await userService.createUser(TENANT_A, {
      email: "c@c.com",
      name: "c",
      roleId: role.id,
      managerId: null,
    });

    await userService.setManager(TENANT_A, a.id, b.id);
    await userService.setManager(TENANT_A, b.id, c.id);
    await expect(userService.setManager(TENANT_A, c.id, a.id)).rejects.toThrow(ManagerCycleError);
  });

  it("allows broken chain", async () => {
    const role = await roleService.createRole(TENANT_A, { name: "admin" });
    const a = await userService.createUser(TENANT_A, {
      email: "a@a.com",
      name: "a",
      roleId: role.id,
      managerId: null,
    });
    const b = await userService.createUser(TENANT_A, {
      email: "b@b.com",
      name: "b",
      roleId: role.id,
      managerId: null,
    });
    const c = await userService.createUser(TENANT_A, {
      email: "c@c.com",
      name: "c",
      roleId: role.id,
      managerId: null,
    });

    await userService.setManager(TENANT_A, b.id, c.id);
    await userRepo.delete(TENANT_A, c.id); // break the chain manually
    await userService.setManager(TENANT_A, a.id, b.id); // should not throw
    const aUpdated = await userService.findUserById(TENANT_A, a.id);
    expect(aUpdated?.managerId).toBe(b.id);
  });

  it("throws depth-limit error on deep chain", async () => {
    const role = await roleService.createRole(TENANT_A, { name: "admin" });
    const users: UserId[] = [];
    for (let i = 0; i <= 51; i++) {
      const u = await userService.createUser(TENANT_A, {
        email: `u${i}@u.com`,
        name: `u${i}`,
        roleId: role.id,
        managerId: null,
      });
      users.push(u.id);
    }
    for (let i = 0; i < 51; i++) {
      const current = users[i];
      const next = users[i + 1];
      if (!current || !next) throw new Error("setup invariant");
      await userService.setManager(TENANT_A, current, next);
    }
    const newUser = await userService.createUser(TENANT_A, {
      email: "new@u.com",
      name: "new",
      roleId: role.id,
      managerId: null,
    });
    const root = users[0];
    if (!root) throw new Error("setup invariant");
    await expect(userService.setManager(TENANT_A, newUser.id, root)).rejects.toThrow(
      /exceeds maximum chain depth/,
    );
  });

  it("successfully clears manager", async () => {
    const role = await roleService.createRole(TENANT_A, { name: "admin" });
    const m = await userService.createUser(TENANT_A, {
      email: "m@m.com",
      name: "m",
      roleId: role.id,
      managerId: null,
    });
    const u = await userService.createUser(TENANT_A, {
      email: "u@u.com",
      name: "u",
      roleId: role.id,
      managerId: m.id,
    });

    const updated = await userService.setManager(TENANT_A, u.id, null);
    expect(updated.managerId).toBeNull();
  });

  it("rejects non-existent manager", async () => {
    const role = await roleService.createRole(TENANT_A, { name: "admin" });
    const u = await userService.createUser(TENANT_A, {
      email: "u@u.com",
      name: "u",
      roleId: role.id,
      managerId: null,
    });
    await expect(userService.setManager(TENANT_A, u.id, userId("bad-id"))).rejects.toThrow(
      ManagerNotFoundError,
    );
  });
});
