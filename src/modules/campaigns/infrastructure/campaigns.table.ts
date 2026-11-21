import { sql } from "drizzle-orm";
import { check, date, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { customers } from "@/modules/customers/infrastructure/customers.tables";
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
    /** When the campaign's debt is due (D37). */
    dueOn: date({ mode: "string" }).notNull(),
    status: text({ enum: ["open", "closed"] })
      .notNull()
      .default("open"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex(CAMPAIGN_SEASON_YEAR_KEY).on(table.season, table.year),
    check("campaigns_period_check", sql`${table.endsOn} > ${table.startsOn}`),
    check("campaigns_due_check", sql`${table.dueOn} >= ${table.endsOn}`),
  ],
);

/** A later due date for one customer in one campaign (D37); one per customer and campaign. */
export const dueDateExtensions = pgTable(
  "due_date_extensions",
  {
    id: id(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id),
    dueOn: date({ mode: "string" }).notNull(),
    reason: text().notNull(),
    createdBy: text().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("due_date_extensions_customer_campaign_key").on(table.customerId, table.campaignId),
  ],
);
