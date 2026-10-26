import { sql } from "drizzle-orm";
import { check, date, index, numeric, pgTable, text, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { campaigns } from "@/modules/campaigns/infrastructure/campaigns.table";
import { customers } from "@/modules/customers/infrastructure/customers.tables";
import { createdAt, id } from "@/shared/infrastructure/db/columns";
import { LEDGER_KINDS, LEDGER_SOURCE_TYPES } from "../domain/ledger";

/**
 * The customer ledger (M7): every change to a customer's debt. A trigger in the migration rejects
 * UPDATE and DELETE; voids append reversing entries instead (D6).
 */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: id(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id),
    entryDate: date({ mode: "string" }).notNull(),
    kind: text({ enum: LEDGER_KINDS }).notNull(),
    /** US dollars; positive = debit, negative = credit. */
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    sourceType: text({ enum: LEDGER_SOURCE_TYPES }).notNull(),
    sourceId: uuid().notNull(),
    /** An entry is reversed at most once. */
    reversesEntryId: uuid()
      .unique()
      .references((): AnyPgColumn => ledgerEntries.id),
    createdBy: text().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index().on(table.customerId, table.campaignId),
    index().on(table.sourceType, table.sourceId),
    check("ledger_entries_amount_not_zero", sql`${table.amount} <> 0`),
  ],
);
