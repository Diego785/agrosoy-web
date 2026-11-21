import { z } from "zod";
import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { optionalText } from "@/shared/domain/text";
import type { InvoiceCandidate, NoteRepository, NoteView } from "./note-ports";
import { noteInvoiceSchema } from "./note-schemas";

export type NoteInvoiceDeps = { notes: NoteRepository; audit: AuditTrail };

/**
 * The confirmed deliveries of the note's customer and campaign, which one invoice can cover (D40):
 * Agrosoil often invoices a company once, at the end of the campaign.
 */
export async function invoiceCandidates(
  deps: Pick<NoteInvoiceDeps, "notes">,
  actor: Actor,
  noteId: unknown,
): Promise<InvoiceCandidate[]> {
  assertCan(actor, "notes.invoice");
  const note = await invoiceableNote(deps.notes, noteId);
  return deps.notes.invoiceCandidates(note.customer.id, note.campaign.id);
}

/**
 * Writes, changes or clears the SIN invoice number of a confirmed or imported delivery note, and of
 * the other deliveries of the same customer and campaign the same invoice covers (D40). It is a
 * reference only: the debt, the numbering and the ledger don't change. Each note that changes gets
 * its own entry in the change log.
 */
export async function setNoteInvoice(
  deps: NoteInvoiceDeps,
  actor: Actor,
  noteId: unknown,
  input: unknown,
): Promise<{ updated: number }> {
  assertCan(actor, "notes.invoice");
  const note = await invoiceableNote(deps.notes, noteId);
  const data = validateInput(noteInvoiceSchema, input);
  const invoice = optionalText(data.taxInvoiceNumber) ?? null;

  const candidates = new Map(
    (await deps.notes.invoiceCandidates(note.customer.id, note.campaign.id)).map((candidate) => [
      candidate.id,
      candidate,
    ]),
  );
  const ids = [...new Set([note.id, ...data.alsoNoteIds])];
  if (ids.some((id) => !candidates.has(id))) {
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: {
        alsoNoteIds: ["Solo se pueden marcar boletas confirmadas del mismo cliente y campaña."],
      },
    });
  }

  const changed = ids
    .map((id) => candidates.get(id))
    .filter((candidate): candidate is InvoiceCandidate => candidate?.taxInvoiceNumber !== invoice);
  if (changed.length === 0) return { updated: 0 };

  await deps.notes.setTaxInvoiceNumber(
    changed.map((candidate) => candidate.id),
    invoice,
  );
  for (const candidate of changed) {
    await deps.audit.record({
      actorId: actor.id,
      action: invoice ? "sales.set_invoice" : "sales.clear_invoice",
      entityType: "delivery_note",
      entityId: candidate.id,
      payload: { number: candidate.number, taxInvoiceNumber: invoice, previous: candidate.taxInvoiceNumber },
    });
  }
  return { updated: changed.length };
}

/** Only a confirmed delivery note (typed or imported) takes an invoice number after confirming. */
async function invoiceableNote(notes: NoteRepository, noteId: unknown): Promise<NoteView> {
  const id = validateInput(z.uuid(), noteId);
  const note = await notes.findById(id);
  if (!note) throw new DomainError("NOT_FOUND", { entity: "delivery_note", id });
  if (note.type !== "delivery" || note.status !== "confirmed") {
    throw new DomainError("INVALID_STATE", { status: note.status, type: note.type });
  }
  return note;
}
