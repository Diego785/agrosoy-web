import type { Actor } from "@/shared/application/actor";
import { DEFAULT_ROLE_PERMISSIONS } from "@/shared/application/permissions";
import type { Role } from "@/shared/domain/role";

/** An actor with the default permissions of its role. */
export function actorWithRole(role: Role, id: string = crypto.randomUUID(), name = `Test ${role}`): Actor {
  return { id, name, role, permissions: DEFAULT_ROLE_PERMISSIONS[role] };
}
