import { tenantId as buildTenantId, userId as buildUserId, roleId as buildRoleId, type TenantId, type UserId, type RoleId } from "../../domain/ids.js";
import type { Tenant } from "../../domain/tenant.js";
import type { User } from "../../domain/user.js";
import type { Role } from "../../domain/role.js";
import type { Id, Doc } from "../../../../../convex/_generated/dataModel.js";

// ID Mappers
export const toTenantId = (raw: Id<"tenants">): TenantId => buildTenantId(raw);
export const fromTenantId = (brand: TenantId): Id<"tenants"> => brand as string as Id<"tenants">;

export const toUserId = (raw: Id<"users">): UserId => buildUserId(raw);
export const fromUserId = (brand: UserId): Id<"users"> => brand as string as Id<"users">;

export const toRoleId = (raw: Id<"roles">): RoleId => buildRoleId(raw);
export const fromRoleId = (brand: RoleId): Id<"roles"> => brand as string as Id<"roles">;

// Entity Mappers
export const tenantDocToEntity = (doc: Doc<"tenants">): Tenant => ({
  id: toTenantId(doc._id),
  name: doc.name,
  createdAt: doc.createdAt,
});

export const roleDocToEntity = (doc: Doc<"roles">): Role => ({
  id: toRoleId(doc._id),
  tenantId: toTenantId(doc.tenantId),
  name: doc.name,
  createdAt: doc.createdAt,
});

export const userDocToEntity = (doc: Doc<"users">): User => ({
  id: toUserId(doc._id),
  tenantId: toTenantId(doc.tenantId),
  email: doc.email,
  name: doc.name ?? null,
  roleId: toRoleId(doc.roleId),
  managerId: doc.managerId ? toUserId(doc.managerId) : null,
  image: doc.image ?? null,
  emailVerificationTime: doc.emailVerificationTime ?? null,
  isAnonymous: doc.isAnonymous ?? null,
  phone: doc.phone ?? null,
  createdAt: doc.createdAt,
});
