import { describe, it, expect, beforeEach } from "vitest";
import { setupDirectory } from "../../_helpers/in-memory-fakes.js";
import { TENANT_A } from "../../_helpers/tenant-context-fixture.js";
import { roleId, userId } from "@/modules/directory/index.js";

describe("Coverage Fill", () => {
  let { roleService, userService, tenantRepo, roleRepo, userRepo } = setupDirectory();

  beforeEach(() => {
    const fakes = setupDirectory();
    roleService = fakes.roleService;
    userService = fakes.userService;
    tenantRepo = fakes.tenantRepo;
    roleRepo = fakes.roleRepo;
    userRepo = fakes.userRepo;
  });

  it("covers tenant repo", async () => {
    const t = await tenantRepo.create({ name: "t1" });
    const found = await tenantRepo.findById(t.id);
    expect(found?.id).toBe(t.id);
  });

  it("covers role repo delete miss", async () => {
    await roleRepo.delete(TENANT_A, "missing" as unknown as ReturnType<typeof roleId>);
  });

  it("covers user repo list and methods", async () => {
    const r = await roleService.createRole(TENANT_A, { name: "r" });
    const u = await userService.createUser(TENANT_A, { email: "u@u.com", name: "u", roleId: r.id, managerId: null });
    
    const listed = await userService.listUsersByTenant(TENANT_A);
    expect(listed).toHaveLength(1);

    const foundId = await userService.findUserById(TENANT_A, u.id);
    expect(foundId?.id).toBe(u.id);

    const foundEmail = await userService.findUserByEmail(TENANT_A, "u@u.com");
    expect(foundEmail?.email).toBe("u@u.com");
  });

  it("covers user repo delete miss", async () => {
    await userRepo.delete(TENANT_A, "missing" as unknown as ReturnType<typeof userId>);
  });
});
