import type { Role } from "@/shared/domain/role";

/** The signed-in person a use case runs for. */
export type Actor = {
  id: string;
  name: string;
  role: Role;
};
