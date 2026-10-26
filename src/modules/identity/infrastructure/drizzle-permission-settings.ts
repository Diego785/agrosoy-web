import { eq } from "drizzle-orm";
import { isPermission, type PermissionOverride } from "@/shared/application/permissions";
import { isRole } from "@/shared/domain/role";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import type { PermissionSettings } from "../application/ports";
import { rolePermissionOverrides } from "./permissions.table";

export function drizzlePermissionSettings(executor: DbExecutor): PermissionSettings {
  return {
    async overrides() {
      const rows = await executor.select().from(rolePermissionOverrides);
      // Rows for permissions removed from the code are ignored rather than failing every request.
      return rows.flatMap((row): PermissionOverride[] =>
        isRole(row.role) && isPermission(row.permission)
          ? [{ role: row.role, permission: row.permission, granted: row.granted }]
          : [],
      );
    },

    async saveRole(role, overrides, updatedBy) {
      await executor.delete(rolePermissionOverrides).where(eq(rolePermissionOverrides.role, role));
      if (overrides.length > 0) {
        await executor
          .insert(rolePermissionOverrides)
          .values(overrides.map((override) => ({ ...override, updatedBy })));
      }
    },
  };
}
