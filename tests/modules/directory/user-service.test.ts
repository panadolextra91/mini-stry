import { describe, it, expect, beforeEach } from "vitest";
import { setupDirectory } from "../../_helpers/in-memory-fakes.js";
import { TENANT_A, TENANT_B } from "../../_helpers/tenant-context-fixture.js";
import { EmailAlreadyExistsError, RoleNotFoundError, UserNotFoundError, ManagerNotFoundError, userId } from "@/modules/directory/index.js";

describe("UserService", () => {
  let { roleService, userService } = setupDirectory();

  beforeEach(() => {
    const fakes = setupDirectory();
    roleService = fakes.roleService;
    userService = fakes.userService;
  });

  describe("createUser", () => {
    it("creates user successfully", async () => {
      const role = await roleService.createRole(TENANT_A, { name: "admin" });
      const user = await userService.createUser(TENANT_A, { email: "u@example.com", name: "U", roleId: role.id, managerId: null });
      expect(user.id).toBeDefined();
      expect(user.email).toBe("u@example.com");
    });

    it("rejects duplicate email", async () => {
      const role = await roleService.createRole(TENANT_A, { name: "admin" });
      await userService.createUser(TENANT_A, { email: "u@example.com", name: "U", roleId: role.id, managerId: null });
      await expect(userService.createUser(TENANT_A, { email: "u@example.com", name: "U2", roleId: role.id, managerId: null })).rejects.toThrow(EmailAlreadyExistsError);
    });

    it("rejects cross-tenant role", async () => {
      const roleB = await roleService.createRole(TENANT_B, { name: "admin" });
      await expect(userService.createUser(TENANT_A, { email: "u@example.com", name: "U", roleId: roleB.id, managerId: null })).rejects.toThrow(RoleNotFoundError);
    });

    it("rejects invalid manager", async () => {
      const role = await roleService.createRole(TENANT_A, { name: "admin" });
      await expect(userService.createUser(TENANT_A, { email: "u@example.com", name: "U", roleId: role.id, managerId: userId("bad-id") })).rejects.toThrow(ManagerNotFoundError);
    });
  });

  describe("updateUserProfile", () => {
    it("updates profile", async () => {
      const role = await roleService.createRole(TENANT_A, { name: "admin" });
      const user = await userService.createUser(TENANT_A, { email: "u@example.com", name: "U", roleId: role.id, managerId: null });
      const updated = await userService.updateUserProfile(TENANT_A, user.id, { name: "New Name" });
      expect(updated.name).toBe("New Name");
      expect(updated.email).toBe("u@example.com"); // preserved
    });

    it("throws if not found", async () => {
      await expect(userService.updateUserProfile(TENANT_A, userId("bad-id"), { name: "N" })).rejects.toThrow(UserNotFoundError);
    });
  });

  describe("assignRole", () => {
    it("assigns role successfully", async () => {
      const r1 = await roleService.createRole(TENANT_A, { name: "r1" });
      const r2 = await roleService.createRole(TENANT_A, { name: "r2" });
      const user = await userService.createUser(TENANT_A, { email: "u@example.com", name: "U", roleId: r1.id, managerId: null });
      
      const updated = await userService.assignRole(TENANT_A, user.id, r2.id);
      expect(updated.roleId).toBe(r2.id);
    });

    it("rejects cross-tenant role", async () => {
      const r1 = await roleService.createRole(TENANT_A, { name: "r1" });
      const r2 = await roleService.createRole(TENANT_B, { name: "r2" });
      const user = await userService.createUser(TENANT_A, { email: "u@example.com", name: "U", roleId: r1.id, managerId: null });
      
      await expect(userService.assignRole(TENANT_A, user.id, r2.id)).rejects.toThrow(RoleNotFoundError);
    });
  });

  describe("deleteUser", () => {
    it("deletes user", async () => {
      const role = await roleService.createRole(TENANT_A, { name: "admin" });
      const user = await userService.createUser(TENANT_A, { email: "u@example.com", name: "U", roleId: role.id, managerId: null });
      await userService.deleteUser(TENANT_A, user.id);
      const found = await userService.findUserById(TENANT_A, user.id);
      expect(found).toBeNull();
    });

    it("throws if missing", async () => {
      await expect(userService.deleteUser(TENANT_A, userId("bad-id"))).rejects.toThrow(UserNotFoundError);
    });
  });
});
