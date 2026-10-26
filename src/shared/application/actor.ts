import type { Role } from "@/shared/domain/role";
import type { Permission } from "./permissions";

/** The signed-in person a use case runs for, with the permissions in force for their role. */
export type Actor = {
  id: string;
  name: string;
  role: Role;
  permissions: readonly Permission[];
};
