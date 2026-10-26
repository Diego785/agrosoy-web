import { sql } from "drizzle-orm";
import { check, date, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps } from "@/shared/infrastructure/db/columns";

export const CAMPAIGN_SEASON_YEAR_KEY = "campaigns_season_year_key";

export const campaigns = pgTable(
  "campaigns",
  {
    id: id(),
    season: text({ enum: ["summer", "winter"] }).notNull(),
    year: integer().notNull(),
    startsOn: date({ mode: "string" }).notNull(),
    endsOn: date({ mode: "string" }).notNull(),
    status: text({ enum: ["open", "closed"] })
      .notNull()
      .default("open"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex(CAMPAIGN_SEASON_YEAR_KEY).on(table.season, table.year),
    check("campaigns_period_check", sql`${table.endsOn} > ${table.startsOn}`),
  ],
);
