import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { campaigns } from "@/modules/campaigns/infrastructure/campaigns.table";
import { presentations } from "@/modules/catalog/infrastructure/catalog.tables";
import { customerProperties, customers } from "@/modules/customers/infrastructure/customers.tables";
import { users } from "@/modules/identity/infrastructure/auth.tables";
import { id, timestamps } from "@/shared/infrastructure/db/columns";

/**
 * Delivery notes ("boletas", M5): drafts are edited freely; confirming gives the number and posts
 * the debt; a confirmed note is only voided, with a reason (D6).
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
    /** Returns and campaign transfers: the delivery note they act on. */
    originalNoteId: uuid().references((): AnyPgColumn => deliveryNotes.id),
    /** Notes brought in from a spreadsheet (M12): confirmed without a system number. */
    imported: boolean().notNull().default(false),
    importBatchId: uuid(),
    /** The number written in the spreadsheet, which may repeat; never the system's numbering. */
    sheetNumber: integer(),
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
    /** Agrosoil's person who hands the product over: the technician by default (D26). */
    handedOverById: uuid().references(() => users.id),
    /** Optional transport, printed on the note: company or driver, vehicle, driver's CI. */
    carrierName: text(),
    carrierVehicle: text(),
    carrierDocumentId: text(),
    observations: text(),
    taxInvoiceNumber: text(),
    createdBy: text().notNull(),
    confirmedAt: timestamp({ withTimezone: true }),
    confirmedBy: text(),
    voidedAt: timestamp({ withTimezone: true }),
    voidedBy: text(),
    voidReason: text(),
    ...timestamps,
  },
  (table) => [
    index().on(table.customerId),
    index().on(table.status, table.noteDate),
    index().on(table.originalNoteId),
    check(
      "delivery_notes_follow_ups_have_original",
      sql`(${table.type} = 'delivery') = (${table.originalNoteId} is null)`,
    ),
    check(
      "delivery_notes_confirmed_have_number",
      sql`${table.status} = 'draft' or ${table.number} is not null or ${table.imported}`,
    ),
    index().on(table.importBatchId),
    check(
      "delivery_notes_voided_have_reason",
      sql`${table.status} <> 'voided' or ${table.voidReason} is not null`,
    ),
  ],
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
    /** Returns and campaign transfers: the delivered line they give back or move. */
    originalLineId: uuid().references((): AnyPgColumn => deliveryNoteLines.id),
  },
  (table) => [index().on(table.noteId), index().on(table.originalLineId)],
);
