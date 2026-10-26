import { sql } from "drizzle-orm";
import { check, date, index, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { campaigns } from "@/modules/campaigns/infrastructure/campaigns.table";
import { customers } from "@/modules/customers/infrastructure/customers.tables";
import { deliveryNotes } from "@/modules/sales/infrastructure/notes.tables";
import { createdAt, id, timestamps } from "@/shared/infrastructure/db/columns";
import { CURRENCIES, PAYMENT_METHODS } from "../domain/payment";

const voidColumns = {
  status: text({ enum: ["recorded", "voided"] })
    .notNull()
    .default("recorded"),
  voidedAt: timestamp({ withTimezone: true }),
  voidedBy: text(),
  voidReason: text(),
};

/** Payments received (M6). Each has a receipt number and credits the ledger through its allocations. */
export const payments = pgTable(
  "payments",
  {
    id: id(),
    receiptNumber: integer().notNull().unique(),
    paymentDate: date({ mode: "string" }).notNull(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id),
    currency: text({ enum: CURRENCIES }).notNull(),
    /** In the currency paid. */
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    exchangeRate: numeric({ precision: 10, scale: 4 }).notNull(),
    usdAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    method: text({ enum: PAYMENT_METHODS }).notNull(),
    inKindDescription: text(),
    reference: text(),
    observations: text(),
    /** The cash note received together with this payment. */
    settlesNoteId: uuid().references(() => deliveryNotes.id),
    ...voidColumns,
    createdBy: text().notNull(),
    ...timestamps,
  },
  (table) => [
    index().on(table.customerId),
    index().on(table.paymentDate),
    index().on(table.settlesNoteId),
    check("payments_amounts_positive", sql`${table.amount} > 0 and ${table.usdAmount} > 0`),
    check("payments_voided_have_reason", sql`${table.status} <> 'voided' or ${table.voidReason} is not null`),
  ],
);

/** How a payment was applied: one ledger credit per row. */
export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: id(),
    paymentId: uuid()
      .notNull()
      .references(() => payments.id),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id),
    /** Set when administration applied the payment to a specific note. */
    noteId: uuid().references(() => deliveryNotes.id),
    usdAmount: numeric({ precision: 14, scale: 2 }).notNull(),
  },
  (table) => [
    index().on(table.paymentId),
    index().on(table.noteId),
    check("payment_allocations_amount_positive", sql`${table.usdAmount} > 0`),
  ],
);

/** Extra debits such as interest, entered by administration with a reason. */
export const charges = pgTable(
  "charges",
  {
    id: id(),
    chargeDate: date({ mode: "string" }).notNull(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id),
    usdAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    reason: text().notNull(),
    ...voidColumns,
    createdBy: text().notNull(),
    ...timestamps,
  },
  (table) => [
    index().on(table.customerId),
    check("charges_amount_positive", sql`${table.usdAmount} > 0`),
    check("charges_voided_have_reason", sql`${table.status} <> 'voided' or ${table.voidReason} is not null`),
  ],
);

/** The day's rate, recorded by administration for customers whose agreement is `daily`. */
export const dailyExchangeRates = pgTable("daily_exchange_rates", {
  rateDate: date({ mode: "string" }).primaryKey(),
  rate: numeric({ precision: 10, scale: 4 }).notNull(),
  recordedBy: text().notNull(),
  recordedAt: createdAt(),
});
