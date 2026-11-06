import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { campaigns } from "@/modules/campaigns/infrastructure/campaigns.table";
import { presentations, products } from "@/modules/catalog/infrastructure/catalog.tables";
import { charges, payments } from "@/modules/collections/infrastructure/collections.tables";
import { customers } from "@/modules/customers/infrastructure/customers.tables";
import { deliveryNoteLines, deliveryNotes } from "@/modules/sales/infrastructure/notes.tables";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import type { NoteDetail, StatementReader } from "../application/statement-ports";
import { ledgerEntries } from "./ledger.tables";

/** Statements read across modules (domain model: read models may join), never write. */
export function drizzleStatementReader(executor: DbExecutor): StatementReader {
  return {
    async entries({ customerId, campaignId, technicianId }) {
      const rows = await executor
        .select({ entry: ledgerEntries })
        .from(ledgerEntries)
        .innerJoin(customers, eq(customers.id, ledgerEntries.customerId))
        .innerJoin(campaigns, eq(campaigns.id, ledgerEntries.campaignId))
        .where(
          and(
            customerId ? eq(ledgerEntries.customerId, customerId) : undefined,
            campaignId ? eq(ledgerEntries.campaignId, campaignId) : undefined,
            technicianId ? eq(customers.technicianId, technicianId) : undefined,
          ),
        )
        // Entries written together (a payment's allocations, a cash note and its payment) share
        // their time: oldest campaign first, then debits before credits.
        .orderBy(
          asc(ledgerEntries.entryDate),
          asc(ledgerEntries.createdAt),
          asc(campaigns.startsOn),
          asc(ledgerEntries.kind),
          asc(ledgerEntries.id),
        );
      return rows.map(({ entry }) => ({
        id: entry.id,
        customerId: entry.customerId,
        campaignId: entry.campaignId,
        date: entry.entryDate,
        kind: entry.kind,
        amount: entry.amount,
        source: { type: entry.sourceType, id: entry.sourceId },
        reversesEntryId: entry.reversesEntryId,
      }));
    },

    async customers(ids) {
      if (ids.length === 0) return [];
      return executor
        .select({ id: customers.id, code: customers.code, name: customers.name })
        .from(customers)
        .where(inArray(customers.id, [...ids]));
    },

    async campaigns() {
      return executor
        .select({
          id: campaigns.id,
          season: campaigns.season,
          year: campaigns.year,
          startsOn: campaigns.startsOn,
        })
        .from(campaigns)
        .orderBy(asc(campaigns.startsOn));
    },

    async notes(ids) {
      const result = new Map<string, NoteDetail>();
      if (ids.length === 0) return result;
      const [headers, lines] = await Promise.all([
        executor
          .select({
            id: deliveryNotes.id,
            // Imported notes show the number the spreadsheet gave them.
            number: sql<number | null>`coalesce(${deliveryNotes.number}, ${deliveryNotes.sheetNumber})`,
            exchangeRate: deliveryNotes.exchangeRate,
            observations: deliveryNotes.observations,
          })
          .from(deliveryNotes)
          .where(inArray(deliveryNotes.id, [...ids])),
        executor
          .select({
            noteId: deliveryNoteLines.noteId,
            productName: products.name,
            content: presentations.content,
            unit: presentations.unit,
            quantity: deliveryNoteLines.quantity,
            unitPrice: deliveryNoteLines.unitPrice,
            freeOfCharge: deliveryNoteLines.freeOfCharge,
            total: deliveryNoteLines.total,
          })
          .from(deliveryNoteLines)
          .innerJoin(presentations, eq(presentations.id, deliveryNoteLines.presentationId))
          .innerJoin(products, eq(products.id, presentations.productId))
          .where(inArray(deliveryNoteLines.noteId, [...ids]))
          .orderBy(asc(deliveryNoteLines.position)),
      ]);
      for (const { id, ...header } of headers) {
        result.set(id, {
          ...header,
          lines: lines.filter((line) => line.noteId === id),
        });
      }
      return result;
    },

    async payments(ids) {
      if (ids.length === 0) return new Map();
      const rows = await executor
        .select({
          id: payments.id,
          receiptNumber: payments.receiptNumber,
          method: payments.method,
          currency: payments.currency,
          amount: payments.amount,
          exchangeRate: payments.exchangeRate,
          reference: payments.reference,
        })
        .from(payments)
        .where(inArray(payments.id, [...ids]));
      return new Map(rows.map(({ id, ...payment }) => [id, payment]));
    },

    async charges(ids) {
      if (ids.length === 0) return new Map();
      const rows = await executor
        .select({ id: charges.id, reason: charges.reason, concept: charges.concept })
        .from(charges)
        .where(inArray(charges.id, [...ids]));
      return new Map(rows.map(({ id, reason, concept }) => [id, { reason, concept }]));
    },
  };
}
