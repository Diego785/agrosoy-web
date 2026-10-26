import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { campaigns } from "@/modules/campaigns/infrastructure/campaigns.table";
import { presentations, products } from "@/modules/catalog/infrastructure/catalog.tables";
import { customerProperties, customers } from "@/modules/customers/infrastructure/customers.tables";
import { users } from "@/modules/identity/infrastructure/auth.tables";
import { DomainError } from "@/shared/domain/domain-error";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import { violatedUniqueConstraint } from "@/shared/infrastructure/db/postgres-errors";
import type { NoteRepository } from "../application/note-ports";
import { lineTotal, type DraftNote } from "../domain/delivery-note";
import { deliveryNoteLines, deliveryNotes } from "./notes.tables";

const NOTE_NUMBER_KEY = "delivery_notes_number_unique";
const confirmer = alias(users, "confirmer");
const voider = alias(users, "voider");

export function drizzleNoteRepository(executor: DbExecutor): NoteRepository {
  async function insertLines(noteId: string, note: DraftNote) {
    await executor.insert(deliveryNoteLines).values(
      note.lines.map((line, position) => ({
        noteId,
        position,
        presentationId: line.presentationId,
        quantity: line.quantity.toDecimalString(),
        unitPrice: line.unitPrice.toDecimalString(),
        freeOfCharge: line.freeOfCharge,
        total: lineTotal(line).toDecimalString(),
      })),
    );
  }

  return {
    async insertDraft(note, createdBy) {
      const [row] = await executor
        .insert(deliveryNotes)
        .values({ ...headerRow(note), createdBy })
        .returning({ id: deliveryNotes.id });
      if (!row) throw new Error("Insert returned no note");
      await insertLines(row.id, note);
      return row;
    },

    async replaceDraft(id, note) {
      const updated = await executor
        .update(deliveryNotes)
        .set(headerRow(note))
        .where(and(eq(deliveryNotes.id, id), eq(deliveryNotes.status, "draft")))
        .returning({ id: deliveryNotes.id });
      if (updated.length === 0) throw new DomainError("NOT_FOUND", { entity: "draft_note", id });
      await executor.delete(deliveryNoteLines).where(eq(deliveryNoteLines.noteId, id));
      await insertLines(id, note);
    },

    async deleteDraft(id) {
      const deleted = await executor
        .delete(deliveryNotes)
        .where(and(eq(deliveryNotes.id, id), eq(deliveryNotes.status, "draft")))
        .returning({ id: deliveryNotes.id });
      if (deleted.length === 0) throw new DomainError("NOT_FOUND", { entity: "draft_note", id });
    },

    async findById(id) {
      const [row] = await executor
        .select({
          note: deliveryNotes,
          customer: { id: customers.id, code: customers.code, name: customers.name },
          propertyName: customerProperties.name,
          campaign: { id: campaigns.id, season: campaigns.season, year: campaigns.year },
          technicianName: users.name,
          confirmerName: confirmer.name,
          voiderName: voider.name,
        })
        .from(deliveryNotes)
        .innerJoin(customers, eq(customers.id, deliveryNotes.customerId))
        .innerJoin(campaigns, eq(campaigns.id, deliveryNotes.campaignId))
        .leftJoin(customerProperties, eq(customerProperties.id, deliveryNotes.propertyId))
        .leftJoin(users, eq(users.id, deliveryNotes.technicianId))
        .leftJoin(confirmer, sql`${confirmer.id}::text = ${deliveryNotes.confirmedBy}`)
        .leftJoin(voider, sql`${voider.id}::text = ${deliveryNotes.voidedBy}`)
        .where(eq(deliveryNotes.id, id));
      if (!row) return undefined;

      const lines = await executor
        .select({
          presentationId: deliveryNoteLines.presentationId,
          productName: products.name,
          content: presentations.content,
          unit: presentations.unit,
          saleUnit: presentations.saleUnit,
          quantity: deliveryNoteLines.quantity,
          unitPrice: deliveryNoteLines.unitPrice,
          freeOfCharge: deliveryNoteLines.freeOfCharge,
          total: deliveryNoteLines.total,
        })
        .from(deliveryNoteLines)
        .innerJoin(presentations, eq(presentations.id, deliveryNoteLines.presentationId))
        .innerJoin(products, eq(products.id, presentations.productId))
        .where(eq(deliveryNoteLines.noteId, id))
        .orderBy(asc(deliveryNoteLines.position));

      const { note } = row;
      return {
        id: note.id,
        status: note.status,
        number: note.number,
        noteDate: note.noteDate,
        customer: row.customer,
        property:
          note.propertyId && row.propertyName ? { id: note.propertyId, name: row.propertyName } : null,
        campaign: row.campaign,
        technician:
          note.technicianId && row.technicianName
            ? { id: note.technicianId, name: row.technicianName }
            : null,
        paymentTerms: note.paymentTerms,
        exchangeRate: note.exchangeRate,
        receiver: {
          name: note.receiverName,
          documentId: note.receiverDocumentId,
          relationship: note.receiverRelationship,
        },
        observations: note.observations,
        taxInvoiceNumber: note.taxInvoiceNumber,
        lines,
        createdAt: note.createdAt,
        confirmed: note.confirmedAt ? { at: note.confirmedAt, byName: row.confirmerName } : null,
        voided:
          note.voidedAt && note.voidReason
            ? { at: note.voidedAt, byName: row.voiderName, reason: note.voidReason }
            : null,
      };
    },

    async markConfirmed(id, number, actorId) {
      try {
        const updated = await executor
          .update(deliveryNotes)
          .set({ status: "confirmed", number, confirmedAt: new Date(), confirmedBy: actorId })
          .where(and(eq(deliveryNotes.id, id), eq(deliveryNotes.status, "draft")))
          .returning({ id: deliveryNotes.id });
        if (updated.length === 0) throw new DomainError("INVALID_STATE", { entity: "delivery_note", id });
      } catch (error) {
        if (violatedUniqueConstraint(error) === NOTE_NUMBER_KEY) {
          throw new DomainError("DUPLICATE", { field: "paperNumber" });
        }
        throw error;
      }
    },

    async markVoided(id, reason, actorId) {
      const updated = await executor
        .update(deliveryNotes)
        .set({ status: "voided", voidReason: reason, voidedAt: new Date(), voidedBy: actorId })
        .where(and(eq(deliveryNotes.id, id), eq(deliveryNotes.status, "confirmed")))
        .returning({ id: deliveryNotes.id });
      if (updated.length === 0) throw new DomainError("INVALID_STATE", { entity: "delivery_note", id });
    },

    async numberInUse(number) {
      const [row] = await executor
        .select({ id: deliveryNotes.id })
        .from(deliveryNotes)
        .where(eq(deliveryNotes.number, number));
      return row !== undefined;
    },

    async list({ status, limit, offset }) {
      const where = status ? eq(deliveryNotes.status, status) : undefined;
      const totals = executor
        .select({
          noteId: deliveryNoteLines.noteId,
          total: sql<string>`sum(${deliveryNoteLines.total})`.as("total"),
        })
        .from(deliveryNoteLines)
        .groupBy(deliveryNoteLines.noteId)
        .as("totals");
      const [items, counted] = await Promise.all([
        executor
          .select({
            id: deliveryNotes.id,
            status: deliveryNotes.status,
            number: deliveryNotes.number,
            noteDate: deliveryNotes.noteDate,
            customerName: customers.name,
            paymentTerms: deliveryNotes.paymentTerms,
            total: sql<string>`coalesce(${totals.total}, 0)::numeric(14,2)::text`,
          })
          .from(deliveryNotes)
          .innerJoin(customers, eq(customers.id, deliveryNotes.customerId))
          .leftJoin(totals, eq(totals.noteId, deliveryNotes.id))
          .where(where)
          .orderBy(desc(deliveryNotes.noteDate), desc(deliveryNotes.createdAt))
          .limit(limit)
          .offset(offset),
        executor.select({ total: count() }).from(deliveryNotes).where(where),
      ]);
      return { items, total: counted[0]?.total ?? 0 };
    },
  };
}

function headerRow(note: DraftNote) {
  return {
    noteDate: note.noteDate,
    customerId: note.customerId,
    propertyId: note.propertyId,
    campaignId: note.campaignId,
    technicianId: note.technicianId,
    paymentTerms: note.paymentTerms,
    exchangeRate: note.exchangeRate.toDecimalString(),
    receiverName: note.receiver.name,
    receiverDocumentId: note.receiver.documentId,
    receiverRelationship: note.receiver.relationship,
    observations: note.observations,
    taxInvoiceNumber: note.taxInvoiceNumber,
  };
}
