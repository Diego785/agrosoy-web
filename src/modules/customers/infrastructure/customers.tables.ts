import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/modules/identity/infrastructure/auth.tables";
import { id, timestamps } from "@/shared/infrastructure/db/columns";

export const ZONE_NAME_KEY = "zones_comparison_name_key";
export const CUSTOMER_NAME_KEY = "customers_comparison_name_key";

export const zones = pgTable(
  "zones",
  {
    id: id(),
    name: text().notNull(),
    comparisonName: text().notNull(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex(ZONE_NAME_KEY).on(table.comparisonName)],
);

export const customers = pgTable(
  "customers",
  {
    id: id(),
    /** Automatic customer code, shown with four digits (formatCustomerCode). */
    code: integer().notNull().unique().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    comparisonName: text().notNull(),
    taxId: text(),
    phone: text(),
    zoneId: uuid().references(() => zones.id),
    technicianId: uuid().references(() => users.id),
    exchangeRateKind: text({ enum: ["daily", "fixed"] })
      .notNull()
      .default("daily"),
    fixedExchangeRate: numeric({ precision: 10, scale: 4 }),
    notes: text(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex(CUSTOMER_NAME_KEY).on(table.comparisonName),
    index("customers_tax_id_idx").on(table.taxId),
    index("customers_zone_id_idx").on(table.zoneId),
    index("customers_technician_id_idx").on(table.technicianId),
    // A fixed agreement always has its rate, and a daily one never does.
    check(
      "customers_fixed_rate_check",
      sql`(${table.exchangeRateKind} = 'fixed') = (${table.fixedExchangeRate} is not null)`,
    ),
  ],
);
