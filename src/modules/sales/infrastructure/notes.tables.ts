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
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { campaigns } from "@/modules/campaigns/infrastructure/campaigns.table";
import { presentations } from "@/modules/catalog/infrastructure/catalog.tables";
import { customerProperties, customers } from "@/modules/customers/infrastructure/customers.tables";
import { users } from "@/modules/identity/infrastructure/auth.tables";
import { id, timestamps } from "@/shared/infrastructure/db/columns";

/** A number belongs to one standing note; a voided note's printed number can be typed again (D28). */
export const NOTE_NUMBER_KEY = "delivery_notes_number_key";

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
    /** Assigned on confirmation; unique among notes that aren't voided. */
    number: integer(),
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
    /** Null on a credit note whose rate is only agreed when the customer pays (D35). */
    exchangeRate: numeric({ precision: 10, scale: 4 }),
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
    uniqueIndex(NOTE_NUMBER_KEY)
      .on(table.number)
      .where(sql`${table.status} <> 'voided'`),
    check(
      "delivery_notes_confirmed_have_number",
      sql`${table.status} = 'draft' or ${table.number} is not null or ${table.imported}`,
    ),
    index().on(table.importBatchId),
    check(
      "delivery_notes_voided_have_reason",
      sql`${table.status} <> 'voided' or ${table.voidReason} is not null`,
    ),
    check(
      "delivery_notes_cash_have_rate",
      sql`${table.paymentTerms} = 'credit' or ${table.exchangeRate} is not null`,
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
    /**
     * Returns and campaign transfers: the line they give back or move, from any delivery or transfer
     * of the customer in the campaign (D25); its note is where the product came from.
     */
    originalLineId: uuid().references((): AnyPgColumn => deliveryNoteLines.id),
  },
  (table) => [index().on(table.noteId), index().on(table.originalLineId)],
);
