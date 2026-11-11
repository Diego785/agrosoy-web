import { eq } from "drizzle-orm";
import { jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { SETTING_KEYS, type SettingsStore } from "@/shared/application/settings-store";
import type { DbExecutor } from "./client";
import { timestamps } from "./columns";

export const appSettings = pgTable("app_settings", {
  key: text({ enum: SETTING_KEYS }).primaryKey(),
  value: jsonb().notNull(),
  updatedBy: text().notNull(),
  ...timestamps,
});

export function drizzleSettingsStore(executor: DbExecutor): SettingsStore {
  return {
    async get(key) {
      const [row] = await executor
        .select({ value: appSettings.value })
        .from(appSettings)
        .where(eq(appSettings.key, key));
      return row?.value;
    },

    async set(key, value, actorId) {
      await executor
        .insert(appSettings)
        .values({ key, value, updatedBy: actorId })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value, updatedBy: actorId, updatedAt: new Date() },
        });
    },
  };
}
