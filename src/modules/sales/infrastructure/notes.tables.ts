import { date, index, integer, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { campaigns } from "@/modules/campaigns/infrastructure/campaigns.table";
import { presentations } from "@/modules/catalog/infrastructure/catalog.tables";
import { customerProperties, customers } from "@/modules/customers/infrastructure/customers.tables";
import { users } from "@/modules/identity/infrastructure/auth.tables";
import { id, timestamps } from "@/shared/infrastructure/db/columns";

/**
 * Delivery notes ("boletas", M5). Week 2 stores drafts; confirming (number, ledger, stock) and the
 * return and campaign-transfer types arrive in week 3 on these same tables.
 */
export const deliveryNotes = pgTable(
  "delivery_notes",
  {
    id: id(),
    status: text({ enum: ["draft", "confirmed", "voided"] })
      .notNull()
      .default("draft"),
    type: text({ enum: ["delivery", "return", "campaign_transfer"] })
      .notNull()
      .default("delivery"),
    /** Assigned on confirmation, continuing the paper pad; unique once set. */
    number: integer().unique(),
    noteDate: date({ mode: "string" }).notNull(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id),
    propertyId: uuid().references(() => customerProperties.id),
    campaignId: uuid()
      .notNull()
      .references(() => campaigns.id),
    technicianId: uuid().references(() => users.id),
    paymentTerms: text({ enum: ["cash", "credit"] }).notNull(),
    exchangeRate: numeric({ precision: 10, scale: 4 }).notNull(),
    receiverName: text().notNull(),
    receiverDocumentId: text(),
    receiverRelationship: text(),
    observations: text(),
    taxInvoiceNumber: text(),
    createdBy: text().notNull(),
    ...timestamps,
  },
  (table) => [index().on(table.customerId), index().on(table.status, table.noteDate)],
);

export const deliveryNoteLines = pgTable(
  "delivery_note_lines",
  {
    id: id(),
    noteId: uuid()
      .notNull()
      .references(() => deliveryNotes.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    presentationId: uuid()
      .notNull()
      .references(() => presentations.id),
    quantity: numeric({ precision: 12, scale: 3 }).notNull(),
    unitPrice: numeric({ precision: 14, scale: 2 }).notNull(),
    freeOfCharge: text({ enum: ["bonus", "sample"] }),
    total: numeric({ precision: 14, scale: 2 }).notNull(),
  },
  (table) => [index().on(table.noteId)],
);
