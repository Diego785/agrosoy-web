import { boolean, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { createdAt } from "@/shared/infrastructure/db/columns";

/** Differences from the default permissions of each role (shared/application/permissions.ts). */
export const rolePermissionOverrides = pgTable(
  "role_permission_overrides",
  {
    role: text().notNull(),
    permission: text().notNull(),
    granted: boolean().notNull(),
    updatedBy: text().notNull(),
    updatedAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.role, table.permission] })],
);
