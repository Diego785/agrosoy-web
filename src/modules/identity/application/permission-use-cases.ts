import { z } from "zod";
import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import {
  assertCan,
  DEFAULT_ROLE_PERMISSIONS,
  effectivePermissions,
  FIXED_ROLE,
  PERMISSIONS,
  type Permission,
  type PermissionOverride,
} from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { ROLES, type Role } from "@/shared/domain/role";
import type { PermissionSettings } from "./ports";

export type PermissionMatrix = {
  role: Role;
  permissions: Permission[];
  /** Administration's permissions are fixed (FIXED_ROLE). */
  editable: boolean;
}[];

const rolePermissionsSchema = z.object({
  role: z.enum(ROLES),
  permissions: z.array(z.enum(PERMISSIONS)),
});

export async function getPermissionMatrix(
  deps: { permissions: PermissionSettings },
  actor: Actor,
): Promise<PermissionMatrix> {
  assertCan(actor, "users.manage");
  const overrides = await deps.permissions.overrides();
  return ROLES.map((role) => ({
    role,
    permissions: effectivePermissions(role, overrides),
    editable: role !== FIXED_ROLE,
  }));
}

/**
 * Sets exactly which permissions a role has, stored as differences from its defaults. A role
 * saved without changes writes nothing, so the audit log only shows real changes.
 */
export async function updateRolePermissions(
  deps: { permissions: PermissionSettings; audit: AuditTrail },
  actor: Actor,
  input: unknown,
): Promise<void> {
  assertCan(actor, "users.manage");
  const { role, permissions } = validateInput(rolePermissionsSchema, input);
  if (role === FIXED_ROLE) throw new DomainError("FORBIDDEN", { reason: "fixed_role", role });

  const wanted = new Set(permissions);
  const current = effectivePermissions(role, await deps.permissions.overrides());
  if (current.length === wanted.size && current.every((permission) => wanted.has(permission))) return;

  const defaults = new Set(DEFAULT_ROLE_PERMISSIONS[role]);
  const overrides: PermissionOverride[] = PERMISSIONS.filter(
    (permission) => wanted.has(permission) !== defaults.has(permission),
  ).map((permission) => ({ role, permission, granted: wanted.has(permission) }));

  await deps.permissions.saveRole(role, overrides, actor.id);
  await deps.audit.record({
    actorId: actor.id,
    action: "identity.update_permissions",
    entityType: "role",
    entityId: role,
    payload: { permissions: PERMISSIONS.filter((permission) => wanted.has(permission)) },
  });
}
