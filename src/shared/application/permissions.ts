import { DomainError } from "@/shared/domain/domain-error";
import type { Role } from "@/shared/domain/role";
import type { Actor } from "./actor";

/** "<module>.<capability>". Each module adds its own as it is built. */
export const PERMISSIONS = [
  "users.manage",
  "audit.view",
  "customers.view",
  "customers.manage",
  "statements.view",
  "imports.manage",
  "catalog.view",
  "catalog.manage",
  "notes.view",
  "notes.manage",
  "notes.void",
  "payments.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * What each role can do until administration adjusts it. Administration and management see and
 * manage everything (discovery meeting). New permissions get their default here, so roles that
 * were adjusted earlier still receive them.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  manager: PERMISSIONS,
  // Technicians can look up any customer and statement, also outside their portfolio (proposal, M7).
  // Technicians write the delivery notes of their sales.
  sales_technician: ["customers.view", "statements.view", "catalog.view", "notes.view", "notes.manage"],
  // Warehouse keepers need customers and products, and see the notes they dispatch.
  warehouse_keeper: ["customers.view", "catalog.view", "notes.view"],
};

/** Administration always keeps every permission, so nobody can lock the system without an administrator. */
export const FIXED_ROLE: Role = "admin";

/** An adjustment saved by administration: this role does (granted) or doesn't have this permission. */
export type PermissionOverride = { role: Role; permission: Permission; granted: boolean };

export function effectivePermissions(role: Role, overrides: readonly PermissionOverride[]): Permission[] {
  if (role === FIXED_ROLE) return [...PERMISSIONS];
  const granted = new Set(DEFAULT_ROLE_PERMISSIONS[role]);
  for (const override of overrides) {
    if (override.role !== role) continue;
    if (override.granted) granted.add(override.permission);
    else granted.delete(override.permission);
  }
  return PERMISSIONS.filter((permission) => granted.has(permission));
}

export function can(actor: Actor, permission: Permission): boolean {
  return actor.permissions.includes(permission);
}

/** Use cases call this first; hiding a button in the UI is never the only check (D3). */
export function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) {
    throw new DomainError("FORBIDDEN", { permission, role: actor.role });
  }
}
