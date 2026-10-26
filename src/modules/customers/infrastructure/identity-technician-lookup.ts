import { drizzleUserDirectory } from "@/modules/identity/infrastructure/drizzle-user-directory";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import type { TechnicianLookup } from "../application/ports";

/** Reads technicians through the identity module's directory instead of its tables (domain model, Modules). */
export function identityTechnicianLookup(executor: DbExecutor): TechnicianLookup {
  const users = drizzleUserDirectory(executor);
  return {
    async listActive() {
      const all = await users.list();
      return all
        .filter((user) => user.active && user.role === "sales_technician")
        .map(({ id, name }) => ({ id, name }));
    },

    async isActiveTechnician(userId) {
      const user = await users.findById(userId);
      return user?.active === true && user.role === "sales_technician";
    },
  };
}
