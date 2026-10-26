import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/modules/identity/infrastructure/auth.tables";
import { createdAt, id, timestamps } from "@/shared/infrastructure/db/columns";

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

const customerId = () =>
  uuid()
    .notNull()
    .references(() => customers.id);

/** Farms or estates of a customer. Deactivated, never deleted: notes may point at them. */
export const customerProperties = pgTable(
  "customer_properties",
  {
    id: id(),
    customerId: customerId(),
    name: text().notNull(),
    location: text(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (table) => [index().on(table.customerId)],
);

/** People who may receive product for a customer, with their CI and position or kinship. */
export const authorizedReceivers = pgTable(
  "authorized_receivers",
  {
    id: id(),
    customerId: customerId(),
    name: text().notNull(),
    documentId: text(),
    relationship: text().notNull(),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (table) => [index().on(table.customerId)],
);

/** Portfolio history: which technician had the customer and when. At most one open per customer. */
export const technicianAssignments = pgTable(
  "technician_assignments",
  {
    id: id(),
    customerId: customerId(),
    technicianId: uuid()
      .notNull()
      .references(() => users.id),
    startsAt: createdAt(),
    endsAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index().on(table.customerId),
    uniqueIndex("technician_assignments_open_key")
      .on(table.customerId)
      .where(sql`${table.endsAt} is null`),
  ],
);
