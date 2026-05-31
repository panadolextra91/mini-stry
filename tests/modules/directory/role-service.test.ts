import { describe, it, expect, beforeEach } from "vitest";
import { setupDirectory } from "../../_helpers/in-memory-fakes.js";
import { TENANT_A, TENANT_B } from "../../_helpers/tenant-context-fixture.js";
import { RoleNameAlreadyExistsError, RoleNotFoundError, roleId } from "@/modules/directory/index.js";

describe("RoleService", () => {
  let { roleService } = setupDirectory();

  beforeEach(() => {
    const fakes = setupDirectory();
    roleService = fakes.roleService;
  });

  describe("createRole", () => {
    it("creates a role", async () => {
      const role = await roleService.createRole(TENANT_A, { name: "admin" });
      expect(role.id).toBeDefined();
      expect(role.name).toBe("admin");
      expect(role.tenantId).toBe(TENANT_A.tenantId);
    });

    it("rejects duplicate name in same tenant", async () => {
      await roleService.createRole(TENANT_A, { name: "admin" });
      await expect(roleService.createRole(TENANT_A, { name: "admin" })).rejects.toThrow(RoleNameAlreadyExistsError);
    });

    it("allows same name in different tenant", async () => {
      await roleService.createRole(TENANT_A, { name: "admin" });
      const roleB = await roleService.createRole(TENANT_B, { name: "admin" });
      expect(roleB.tenantId).toBe(TENANT_B.tenantId);
    });
  });

  describe("findRoleById", () => {
    it("finds existing role", async () => {
      const role = await roleService.createRole(TENANT_A, { name: "admin" });
      const found = await roleService.findRoleById(TENANT_A, role.id);
      expect(found?.id).toBe(role.id);
    });

    it("returns null for non-existent role", async () => {
      const found = await roleService.findRoleById(TENANT_A, roleId("not-real"));
      expect(found).toBeNull();
    });
  });

  describe("findRoleByName", () => {
    it("finds role by name", async () => {
      const role = await roleService.createRole(TENANT_A, { name: "admin" });
      const found = await roleService.findRoleByName(TENANT_A, "admin");
      expect(found?.id).toBe(role.id);
    });
  });

  describe("listRolesByTenant", () => {
    it("lists all roles for tenant", async () => {
      await roleService.createRole(TENANT_A, { name: "r1" });
      await roleService.createRole(TENANT_A, { name: "r2" });
      const roles = await roleService.listRolesByTenant(TENANT_A);
      expect(roles).toHaveLength(2);
    });
  });

  describe("renameRole", () => {
    it("renames role successfully", async () => {
      const role = await roleService.createRole(TENANT_A, { name: "r1" });
      const updated = await roleService.renameRole(TENANT_A, role.id, "r1-new");
      expect(updated.name).toBe("r1-new");
    });

    it("throws RoleNotFoundError if missing", async () => {
      await expect(roleService.renameRole(TENANT_A, roleId("not-real"), "new")).rejects.toThrow(RoleNotFoundError);
    });

    it("throws RoleNameAlreadyExistsError on collision", async () => {
      await roleService.createRole(TENANT_A, { name: "r1" });
      const r2 = await roleService.createRole(TENANT_A, { name: "r2" });
      await expect(roleService.renameRole(TENANT_A, r2.id, "r1")).rejects.toThrow(RoleNameAlreadyExistsError);
    });
  });

  describe("deleteRole", () => {
    it("deletes role successfully", async () => {
      const role = await roleService.createRole(TENANT_A, { name: "r1" });
      await roleService.deleteRole(TENANT_A, role.id);
      const found = await roleService.findRoleById(TENANT_A, role.id);
      expect(found).toBeNull();
    });

    it("throws RoleNotFoundError if missing", async () => {
      await expect(roleService.deleteRole(TENANT_A, roleId("not-real"))).rejects.toThrow(RoleNotFoundError);
    });
  });
});
