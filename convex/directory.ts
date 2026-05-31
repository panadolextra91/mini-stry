/**
 * convex/ HARD RULE:
 * Allowed: validate input shape, instantiate dependencies, call application services, map responses.
 * Forbidden: evaluate policies, enforce business rules, perform approval routing, contain domain logic.
 */
import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";
import { RoleService, UserService } from "../src/modules/directory/index.js";
import { ConvexRoleRepository } from "../src/modules/directory/adapters/convex/convex-role-repository.js";
import { ConvexUserRepository } from "../src/modules/directory/adapters/convex/convex-user-repository.js";
import { ConvexTenantRepository } from "../src/modules/directory/adapters/convex/convex-tenant-repository.js";
import { tenantContext, tenantId, userId, roleId } from "../src/modules/directory/index.js";

// TENANT HANDLERS
export const createTenant = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const tenantRepo = new ConvexTenantRepository(ctx.db);
    return tenantRepo.create({ name: args.name });
  }
});

// ROLE HANDLERS
export const createRole = mutation({
  args: { tenantId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const roleRepo = new ConvexRoleRepository(ctx.db);
    const roleService = new RoleService(roleRepo);
    const tCtx = tenantContext(tenantId(args.tenantId));
    return roleService.createRole(tCtx, { name: args.name });
  }
});

export const getRole = query({
  args: { tenantId: v.string(), roleId: v.string() },
  handler: async (ctx, args) => {
    const roleRepo = new ConvexRoleRepository(ctx.db);
    const roleService = new RoleService(roleRepo);
    const tCtx = tenantContext(tenantId(args.tenantId));
    return roleService.findRoleById(tCtx, roleId(args.roleId));
  }
});

// USER HANDLERS
export const createUser = mutation({
  args: { 
    tenantId: v.string(), 
    email: v.string(), 
    name: v.union(v.string(), v.null()), 
    roleId: v.string(), 
    managerId: v.union(v.string(), v.null()) 
  },
  handler: async (ctx, args) => {
    const userRepo = new ConvexUserRepository(ctx.db);
    const roleRepo = new ConvexRoleRepository(ctx.db);
    const userService = new UserService(userRepo, roleRepo);
    const tCtx = tenantContext(tenantId(args.tenantId));
    
    return userService.createUser(tCtx, {
      email: args.email,
      name: args.name,
      roleId: roleId(args.roleId),
      managerId: args.managerId ? userId(args.managerId) : null
    });
  }
});

export const assignRole = mutation({
  args: { tenantId: v.string(), targetUserId: v.string(), newRoleId: v.string() },
  handler: async (ctx, args) => {
    const userRepo = new ConvexUserRepository(ctx.db);
    const roleRepo = new ConvexRoleRepository(ctx.db);
    const userService = new UserService(userRepo, roleRepo);
    const tCtx = tenantContext(tenantId(args.tenantId));
    
    return userService.assignRole(tCtx, userId(args.targetUserId), roleId(args.newRoleId));
  }
});

export const setManager = mutation({
  args: { tenantId: v.string(), targetUserId: v.string(), managerId: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const userRepo = new ConvexUserRepository(ctx.db);
    const roleRepo = new ConvexRoleRepository(ctx.db);
    const userService = new UserService(userRepo, roleRepo);
    const tCtx = tenantContext(tenantId(args.tenantId));
    
    return userService.setManager(tCtx, userId(args.targetUserId), args.managerId ? userId(args.managerId) : null);
  }
});
