import type { Actor } from "@/shared/application/actor";
import type { Role } from "@/shared/domain/role";

export function actorWithRole(role: Role, id = crypto.randomUUID()): Actor {
  return { id, name: `Test ${role}`, role };
}
