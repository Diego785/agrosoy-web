import { z } from "zod";
import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import { paged, pageWindow, type Paged } from "@/shared/application/pagination";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";
import { optionalText } from "@/shared/domain/text";
import { draftNote, noteLine, type DraftNote } from "../domain/delivery-note";
import type { NoteListItem, NoteLookups, NoteRepository, NoteView } from "./note-ports";
import { draftNoteSchema, noteSearchSchema } from "./note-schemas";

export type NoteDeps = { notes: NoteRepository; lookups: NoteLookups; audit: AuditTrail };

export async function createDraftNote(deps: NoteDeps, actor: Actor, input: unknown): Promise<{ id: string }> {
  assertCan(actor, "notes.manage");
  const note = await validNote(deps.lookups, input);
  const created = await deps.notes.insertDraft(note, actor.id);
  await deps.audit.record({
    actorId: actor.id,
    action: "sales.create_draft",
    entityType: "delivery_note",
    entityId: created.id,
    payload: { customerId: note.customerId, lines: note.lines.length },
  });
  return created;
}

export async function updateDraftNote(
  deps: NoteDeps,
  actor: Actor,
  noteId: unknown,
  input: unknown,
): Promise<void> {
  assertCan(actor, "notes.manage");
  const id = validateInput(z.uuid(), noteId);
  const note = await validNote(deps.lookups, input);
  await deps.notes.replaceDraft(id, note);
  await deps.audit.record({
    actorId: actor.id,
    action: "sales.update_draft",
    entityType: "delivery_note",
    entityId: id,
    payload: { customerId: note.customerId, lines: note.lines.length },
  });
}

export async function discardDraftNote(
  deps: Pick<NoteDeps, "notes" | "audit">,
  actor: Actor,
  noteId: unknown,
): Promise<void> {
  assertCan(actor, "notes.manage");
  const id = validateInput(z.uuid(), noteId);
  await deps.notes.deleteDraft(id);
  await deps.audit.record({
    actorId: actor.id,
    action: "sales.discard_draft",
    entityType: "delivery_note",
    entityId: id,
    payload: {},
  });
}

export async function getNote(
  deps: Pick<NoteDeps, "notes">,
  actor: Actor,
  noteId: unknown,
): Promise<NoteView> {
  assertCan(actor, "notes.view");
  const id = validateInput(z.uuid(), noteId);
  const note = await deps.notes.findById(id);
  if (!note) throw new DomainError("NOT_FOUND", { entity: "delivery_note", id });
  return note;
}

export async function listNotes(
  deps: Pick<NoteDeps, "notes">,
  actor: Actor,
  input: unknown,
): Promise<Paged<NoteListItem>> {
  assertCan(actor, "notes.view");
  const { status, page, pages } = validateInput(noteSearchSchema, input);
  const result = await deps.notes.list({ status, ...pageWindow({ page, pages }) });
  return paged({ page, pages }, result);
}

/** Validates the form data and the facts it points at; the campaign comes from the date. */
async function validNote(lookups: NoteLookups, input: unknown): Promise<DraftNote> {
  const data = validateInput(draftNoteSchema, input);
  const fieldErrors: Record<string, string[]> = {};
  const fail = (field: string, message: string) => (fieldErrors[field] = [message]);

  const customer = await lookups.customer(data.customerId);
  if (!customer?.isActive) fail("customerId", "Elige un cliente activo.");
  if (data.propertyId && !customer?.propertyIds.includes(data.propertyId)) {
    fail("propertyId", "La propiedad no es de este cliente.");
  }
  const campaign = await lookups.campaignOn(data.noteDate);
  if (!campaign) fail("noteDate", "La fecha no cae en ninguna campaña.");
  else if (campaign.status === "closed") fail("noteDate", "La campaña de esa fecha ya está cerrada.");
  if (data.technicianId && !(await lookups.isActiveTechnician(data.technicianId))) {
    fail("technicianId", "Elige un técnico de venta activo.");
  }
  if (data.handedOverById && !(await lookups.isActiveUser(data.handedOverById))) {
    fail("handedOverById", "Elige un usuario activo.");
  }
  const available = await lookups.activePresentations(data.lines.map((line) => line.presentationId));
  data.lines.forEach((line, index) => {
    if (!available.has(line.presentationId))
      fail(`lines.${index}.presentationId`, "Ese producto ya no está disponible.");
  });
  if (Object.keys(fieldErrors).length > 0 || !campaign)
    throw new DomainError("VALIDATION_FAILED", { fieldErrors });

  return draftNote({
    noteDate: data.noteDate,
    customerId: data.customerId,
    propertyId: data.propertyId || null,
    campaignId: campaign.id,
    technicianId: data.technicianId || null,
    paymentTerms: data.paymentTerms,
    exchangeRate: ExchangeRate.parse(data.exchangeRate),
    receiver: {
      name: data.receiverName,
      documentId: optionalText(data.receiverDocumentId) ?? null,
      relationship: optionalText(data.receiverRelationship) ?? null,
    },
    handedOverById: data.handedOverById || null,
    carrier: {
      name: optionalText(data.carrierName) ?? null,
      vehicle: optionalText(data.carrierVehicle) ?? null,
      documentId: optionalText(data.carrierDocumentId)?.toUpperCase() ?? null,
    },
    observations: optionalText(data.observations) ?? null,
    taxInvoiceNumber: optionalText(data.taxInvoiceNumber) ?? null,
    lines: data.lines.map((line) =>
      noteLine({
        presentationId: line.presentationId,
        quantity: Quantity.parse(line.quantity),
        unitPrice: line.unitPrice ? Money.parse(line.unitPrice) : Money.zero(),
        freeOfCharge: line.freeOfCharge || null,
      }),
    ),
  });
}
