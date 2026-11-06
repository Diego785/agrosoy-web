import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { campaigns } from "@/modules/campaigns/infrastructure/campaigns.table";
import { presentations, products } from "@/modules/catalog/infrastructure/catalog.tables";
import { customerProperties, customers } from "@/modules/customers/infrastructure/customers.tables";
import { users } from "@/modules/identity/infrastructure/auth.tables";
import { DomainError } from "@/shared/domain/domain-error";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import { violatedUniqueConstraint } from "@/shared/infrastructure/db/postgres-errors";
import type { NoteRepository } from "../application/note-ports";
import { lineTotal, type DraftNote, type ImportedNote } from "../domain/delivery-note";
import { deliveryNoteLines, deliveryNotes } from "./notes.tables";

const NOTE_NUMBER_KEY = "delivery_notes_number_unique";
const confirmer = alias(users, "confirmer");
const voider = alias(users, "voider");
const originalNote = alias(deliveryNotes, "original_note");
const originalCampaign = alias(campaigns, "original_campaign");
const followUpNote = alias(deliveryNotes, "follow_up_note");

function uniqueNumber<T>(write: () => Promise<T>): Promise<T> {
  return write().catch((error: unknown) => {
    if (violatedUniqueConstraint(error) === NOTE_NUMBER_KEY) {
      throw new DomainError("DUPLICATE", { field: "paperNumber" });
    }
    throw error;
  });
}
const handedOverBy = alias(users, "handed_over_by");

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
          customer: { id: customers.id, code: customers.code, name: customers.name, taxId: customers.taxId },
          propertyName: customerProperties.name,
          campaign: { id: campaigns.id, season: campaigns.season, year: campaigns.year },
          technicianName: users.name,
          confirmerName: confirmer.name,
          voiderName: voider.name,
          originalNumber: originalNote.number,
          originalCampaign: { season: originalCampaign.season, year: originalCampaign.year },
          handedOverBy: {
            id: handedOverBy.id,
            name: handedOverBy.name,
            position: handedOverBy.position,
            documentId: handedOverBy.documentId,
          },
        })
        .from(deliveryNotes)
        .innerJoin(customers, eq(customers.id, deliveryNotes.customerId))
        .innerJoin(campaigns, eq(campaigns.id, deliveryNotes.campaignId))
        .leftJoin(customerProperties, eq(customerProperties.id, deliveryNotes.propertyId))
        .leftJoin(users, eq(users.id, deliveryNotes.technicianId))
        .leftJoin(confirmer, sql`${confirmer.id}::text = ${deliveryNotes.confirmedBy}`)
        .leftJoin(voider, sql`${voider.id}::text = ${deliveryNotes.voidedBy}`)
        .leftJoin(originalNote, eq(originalNote.id, deliveryNotes.originalNoteId))
        .leftJoin(originalCampaign, eq(originalCampaign.id, originalNote.campaignId))
        .leftJoin(handedOverBy, eq(handedOverBy.id, deliveryNotes.handedOverById))
        .where(eq(deliveryNotes.id, id));
      if (!row) return undefined;

      const lines = await executor
        .select({
          id: deliveryNoteLines.id,
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
        type: note.type,
        status: note.status,
        number: note.number,
        imported: note.imported ? { sheetNumber: note.sheetNumber } : null,
        original:
          note.originalNoteId && row.originalCampaign
            ? { id: note.originalNoteId, number: row.originalNumber, campaign: row.originalCampaign }
            : null,
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
        handedOverBy: row.handedOverBy?.id ? row.handedOverBy : null,
        carrier: {
          name: note.carrierName,
          vehicle: note.carrierVehicle,
          documentId: note.carrierDocumentId,
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
      const updated = await uniqueNumber(() =>
        executor
          .update(deliveryNotes)
          .set({ status: "confirmed", number, confirmedAt: new Date(), confirmedBy: actorId })
          .where(and(eq(deliveryNotes.id, id), eq(deliveryNotes.status, "draft")))
          .returning({ id: deliveryNotes.id }),
      );
      if (updated.length === 0) throw new DomainError("INVALID_STATE", { entity: "delivery_note", id });
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

    async originalLines(noteId) {
      const settled = executor
        .select({
          originalLineId: deliveryNoteLines.originalLineId,
          quantity: sql<string>`sum(${deliveryNoteLines.quantity})`.as("settled_quantity"),
        })
        .from(deliveryNoteLines)
        .innerJoin(followUpNote, eq(followUpNote.id, deliveryNoteLines.noteId))
        .where(eq(followUpNote.status, "confirmed"))
        .groupBy(deliveryNoteLines.originalLineId)
        .as("settled");
      const rows = await executor
        .select({
          id: deliveryNoteLines.id,
          presentationId: deliveryNoteLines.presentationId,
          quantity: deliveryNoteLines.quantity,
          unitPrice: deliveryNoteLines.unitPrice,
          freeOfCharge: deliveryNoteLines.freeOfCharge,
          settled: sql<string>`coalesce(${settled.quantity}, 0)::numeric(12,3)::text`,
        })
        .from(deliveryNoteLines)
        .leftJoin(settled, eq(settled.originalLineId, deliveryNoteLines.id))
        .where(eq(deliveryNoteLines.noteId, noteId))
        .orderBy(asc(deliveryNoteLines.position));
      return rows.map((row) => ({
        id: row.id,
        presentationId: row.presentationId,
        quantity: Quantity.parse(row.quantity),
        unitPrice: Money.parse(row.unitPrice),
        freeOfCharge: row.freeOfCharge,
        settled: Quantity.parse(row.settled),
      }));
    },

    async followUps(noteId) {
      return executor
        .select({
          id: deliveryNotes.id,
          type: deliveryNotes.type,
          status: deliveryNotes.status,
          number: deliveryNotes.number,
          noteDate: deliveryNotes.noteDate,
        })
        .from(deliveryNotes)
        .where(eq(deliveryNotes.originalNoteId, noteId))
        .orderBy(asc(deliveryNotes.noteDate), asc(deliveryNotes.createdAt));
    },

    async insertFollowUp(note, number, actorId) {
      const [row] = await uniqueNumber(() =>
        executor
          .insert(deliveryNotes)
          .values({
            status: "confirmed",
            type: note.type,
            number,
            originalNoteId: note.originalNoteId,
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
            createdBy: actorId,
            confirmedAt: new Date(),
            confirmedBy: actorId,
          })
          .returning({ id: deliveryNotes.id }),
      );
      if (!row) throw new Error("Insert returned no note");
      await executor.insert(deliveryNoteLines).values(
        note.lines.map((line, position) => ({
          noteId: row.id,
          position,
          presentationId: line.presentationId,
          quantity: line.quantity.toDecimalString(),
          unitPrice: line.unitPrice.toDecimalString(),
          freeOfCharge: line.freeOfCharge,
          total: line.total.toDecimalString(),
          originalLineId: line.originalLineId,
        })),
      );
      return row;
    },

    async insertImported(note: ImportedNote, actorId) {
      const [row] = await executor
        .insert(deliveryNotes)
        .values({
          status: "confirmed",
          type: "delivery",
          imported: true,
          importBatchId: note.importBatchId,
          sheetNumber: note.sheetNumber,
          noteDate: note.noteDate,
          customerId: note.customerId,
          campaignId: note.campaignId,
          paymentTerms: "credit",
          exchangeRate: note.exchangeRate.toDecimalString(),
          receiverName: note.receiverName,
          observations: note.observations,
          createdBy: actorId,
          confirmedAt: new Date(),
          confirmedBy: actorId,
        })
        .returning({ id: deliveryNotes.id });
      if (!row) throw new Error("Insert returned no note");
      await executor.insert(deliveryNoteLines).values(
        note.lines.map((line, position) => ({
          noteId: row.id,
          position,
          presentationId: line.presentationId,
          quantity: line.quantity.toDecimalString(),
          unitPrice: line.unitPrice.toDecimalString(),
          total: line.total.toDecimalString(),
        })),
      );
      return row;
    },

    async importedFrom(batchId) {
      return executor
        .select({ id: deliveryNotes.id })
        .from(deliveryNotes)
        .where(and(eq(deliveryNotes.importBatchId, batchId), eq(deliveryNotes.status, "confirmed")));
    },

    async list({ status, customerId, limit, offset }) {
      const where = and(
        status ? eq(deliveryNotes.status, status) : undefined,
        customerId ? eq(deliveryNotes.customerId, customerId) : undefined,
      );
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
            type: deliveryNotes.type,
            status: deliveryNotes.status,
            number: sql<number | null>`coalesce(${deliveryNotes.number}, ${deliveryNotes.sheetNumber})`,
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
    handedOverById: note.handedOverById,
    carrierName: note.carrier.name,
    carrierVehicle: note.carrier.vehicle,
    carrierDocumentId: note.carrier.documentId,
    observations: note.observations,
    taxInvoiceNumber: note.taxInvoiceNumber,
  };
}
