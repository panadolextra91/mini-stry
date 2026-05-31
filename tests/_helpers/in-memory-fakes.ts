import { InMemoryTenantRepository } from "@/modules/directory/adapters/memory/in-memory-tenant-repository.js";
import { InMemoryRoleRepository } from "@/modules/directory/adapters/memory/in-memory-role-repository.js";
import { InMemoryUserRepository } from "@/modules/directory/adapters/memory/in-memory-user-repository.js";
import { RoleService, UserService } from "@/modules/directory/index.js";

export function setupDirectory() {
  const tenantRepo = new InMemoryTenantRepository();
  const roleRepo = new InMemoryRoleRepository();
  const userRepo = new InMemoryUserRepository();
  const roleService = new RoleService(roleRepo);
  const userService = new UserService(userRepo, roleRepo);
  
  return { tenantRepo, roleRepo, userRepo, roleService, userService };
}
