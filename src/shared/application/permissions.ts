import { DomainError } from "@/shared/domain/domain-error";
import type { Role } from "@/shared/domain/role";
import type { Actor } from "./actor";

/** "<module>.<capability>". Each module adds its own as it is built. */
export const PERMISSIONS = ["users.manage"] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Default permissions per role. Administration and management see and manage everything
 * (discovery meeting); the matrix becomes editable from the users module later in M1.
 */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: ["users.manage"],
  manager: ["users.manage"],
  sales_technician: [],
  warehouse_keeper: [],
};

export function can(actor: Actor, permission: Permission): boolean {
  return ROLE_PERMISSIONS[actor.role].includes(permission);
}

/** Use cases call this first; hiding a button in the UI is never the only check (D3). */
export function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) {
    throw new DomainError("FORBIDDEN", { permission, role: actor.role });
  }
}
