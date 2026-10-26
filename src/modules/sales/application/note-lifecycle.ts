import { z } from "zod";
import { postToLedger, reverseInLedger } from "@/modules/receivables/application/ledger-service";
import type { LedgerRepository } from "@/modules/receivables/application/ledger-ports";
import { posting } from "@/modules/receivables/domain/ledger";
import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import type { DocumentCounter } from "@/shared/application/document-counter";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { Money } from "@/shared/domain/money";
import type { NoteLookups, NoteRepository, NoteView } from "./note-ports";
import { confirmNoteSchema, nextNoteNumberSchema, voidNoteSchema } from "./note-schemas";

export type NoteLifecycleDeps = {
  notes: NoteRepository;
  lookups: Pick<NoteLookups, "campaignOn">;
  numbering: DocumentCounter;
  ledger: LedgerRepository;
  audit: AuditTrail;
  /** Today's business date in Bolivia; voids are dated the day they happen. */
  today: () => string;
};

/**
 * Confirming gives the note its number and charges the customer's debt in the note's campaign, in
 * the caller's transaction (principle 3). Stock is taken here once inventory exists (D18).
 */
export async function confirmNote(
  deps: Omit<NoteLifecycleDeps, "today">,
  actor: Actor,
  noteId: unknown,
  input: unknown,
): Promise<{ number: number }> {
  assertCan(actor, "notes.manage");
  const id = validateInput(z.uuid(), noteId);
  const { paperNumber } = validateInput(confirmNoteSchema, input);
  const note = await existingNote(deps.notes, id);
  if (note.status !== "draft") throw new DomainError("INVALID_STATE", { status: note.status });

  const campaign = await deps.lookups.campaignOn(note.noteDate);
  if (campaign?.id !== note.campaign.id || campaign.status === "closed") {
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: { noteDate: ["La campaña de esta boleta está cerrada. Corrige la fecha del borrador."] },
    });
  }
  if (note.paymentTerms === "cash") {
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: {
        paymentTerms: [
          "Las boletas al contado se confirman junto con su pago; esa opción llega con Cobranzas.",
        ],
      },
    });
  }
  if (paperNumber && (await deps.notes.numberInUse(paperNumber))) {
    throw new DomainError("DUPLICATE", { field: "paperNumber" });
  }

  const number = paperNumber || (await deps.numbering.take((candidate) => deps.notes.numberInUse(candidate)));
  await deps.notes.markConfirmed(id, number, actor.id);
  const total = Money.sum(note.lines.map((line) => Money.parse(line.total)));
  // A note with only bonus or sample lines takes stock but creates no debt.
  if (total.isPositive()) {
    await postToLedger(
      deps.ledger,
      [
        posting({
          customerId: note.customer.id,
          campaignId: note.campaign.id,
          date: note.noteDate,
          kind: "delivery",
          amount: total,
          source: { type: "delivery_note", id },
        }),
      ],
      actor.id,
    );
  }
  await deps.audit.record({
    actorId: actor.id,
    action: "sales.confirm",
    entityType: "delivery_note",
    entityId: id,
    payload: { number, total: total.toDecimalString(), paperNumber: Boolean(paperNumber) },
  });
  return { number };
}

/** Voiding keeps the note and its number and cancels its debt with reversing entries (D6). */
export async function voidNote(
  deps: Omit<NoteLifecycleDeps, "lookups" | "numbering">,
  actor: Actor,
  noteId: unknown,
  input: unknown,
): Promise<void> {
  assertCan(actor, "notes.void");
  const id = validateInput(z.uuid(), noteId);
  const { reason } = validateInput(voidNoteSchema, input);
  const note = await existingNote(deps.notes, id);
  if (note.status !== "confirmed") throw new DomainError("INVALID_STATE", { status: note.status });

  await deps.notes.markVoided(id, reason, actor.id);
  await reverseInLedger(deps.ledger, { type: "delivery_note", id }, deps.today(), actor.id);
  await deps.audit.record({
    actorId: actor.id,
    action: "sales.void",
    entityType: "delivery_note",
    entityId: id,
    payload: { number: note.number, reason },
  });
}

export async function nextNoteNumber(
  deps: Pick<NoteLifecycleDeps, "notes" | "numbering">,
  actor: Actor,
): Promise<number> {
  assertCan(actor, "notes.view");
  return deps.numbering.peek((candidate) => deps.notes.numberInUse(candidate));
}

/** Where numbering continues, e.g. the first page of the pad in use when the system starts. */
export async function setNextNoteNumber(
  deps: Pick<NoteLifecycleDeps, "notes" | "numbering" | "audit">,
  actor: Actor,
  input: unknown,
): Promise<void> {
  assertCan(actor, "notes.void");
  const { nextNumber } = validateInput(nextNoteNumberSchema, input);
  if (await deps.notes.numberInUse(nextNumber)) {
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: { nextNumber: ["Ese número ya lo tiene otra boleta."] },
    });
  }
  await deps.numbering.set(nextNumber);
  await deps.audit.record({
    actorId: actor.id,
    action: "sales.set_next_number",
    entityType: "document_counter",
    entityId: "delivery_note",
    payload: { number: nextNumber },
  });
}

async function existingNote(notes: NoteRepository, id: string): Promise<NoteView> {
  const note = await notes.findById(id);
  if (!note) throw new DomainError("NOT_FOUND", { entity: "delivery_note", id });
  return note;
}
