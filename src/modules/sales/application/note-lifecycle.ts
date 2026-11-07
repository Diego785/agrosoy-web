import { z } from "zod";
import type { PaymentRepository } from "@/modules/collections/application/collection-ports";
import { cancelPayment, savePayment } from "@/modules/collections/application/payment-service";
import { cashNotePayment } from "@/modules/collections/domain/payment";
import { postToLedger, reverseInLedger } from "@/modules/receivables/application/ledger-service";
import type { LedgerRepository } from "@/modules/receivables/application/ledger-ports";
import { posting } from "@/modules/receivables/domain/ledger";
import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import type { DocumentCounter } from "@/shared/application/document-counter";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { Money } from "@/shared/domain/money";
import { optionalText } from "@/shared/domain/text";
import type { NoteLookups, NoteRepository, NoteView } from "./note-ports";
import { confirmNoteSchema, nextNoteNumberSchema, voidNoteSchema } from "./note-schemas";

export type NoteLifecycleDeps = {
  notes: NoteRepository;
  lookups: Pick<NoteLookups, "campaignOn">;
  numbering: DocumentCounter;
  ledger: LedgerRepository;
  /** Cash notes are confirmed together with their payment (collections). */
  payments: PaymentRepository;
  receipts: DocumentCounter;
  audit: AuditTrail;
  /** Today's business date in Bolivia; voids are dated the day they happen. */
  today: () => string;
};

/**
 * Confirming gives the note its number and charges the customer's debt in the note's campaign, in
 * the caller's transaction (principle 3). A cash note also records its payment, which settles the
 * debit at once. Stock is taken here once inventory exists (D18).
 */
export async function confirmNote(
  deps: Omit<NoteLifecycleDeps, "today">,
  actor: Actor,
  noteId: unknown,
  input: unknown,
): Promise<{ number: number; receiptNumber: number | null }> {
  assertCan(actor, "notes.manage");
  const id = validateInput(z.uuid(), noteId);
  const { paperNumber, payment } = validateInput(confirmNoteSchema, input);
  const note = await existingNote(deps.notes, id);
  if (note.status !== "draft") throw new DomainError("INVALID_STATE", { status: note.status });

  const campaign = await deps.lookups.campaignOn(note.noteDate);
  if (campaign?.id !== note.campaign.id || campaign.status === "closed") {
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: { noteDate: ["La campaña de esta boleta está cerrada. Corrige la fecha del borrador."] },
    });
  }
  const total = Money.sum(note.lines.map((line) => Money.parse(line.total)));
  const isPaidNow = note.paymentTerms === "cash" && total.isPositive();
  if (isPaidNow && !payment) {
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: { "payment.currency": ["Indica cómo pagó el cliente."] },
    });
  }
  // The form and the database both keep a rate on cash notes (D35); a payment can't be saved without one.
  if (isPaidNow && !note.exchangeRate) {
    throw new DomainError("INVALID_STATE", { reason: "cash_note_without_rate" });
  }
  if (paperNumber && (await deps.notes.numberInUse(paperNumber))) {
    throw new DomainError("DUPLICATE", { field: "paperNumber" });
  }

  const number = paperNumber || (await deps.numbering.take((candidate) => deps.notes.numberInUse(candidate)));
  await deps.notes.markConfirmed(id, number, actor.id);
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
  let receiptNumber: number | null = null;
  if (isPaidNow && payment && note.exchangeRate) {
    const record = cashNotePayment({
      paymentDate: note.noteDate,
      customerId: note.customer.id,
      total,
      currency: payment.currency,
      exchangeRate: ExchangeRate.parse(note.exchangeRate),
      method: payment.method,
      inKindDescription: optionalText(payment.inKindDescription) ?? null,
      reference: optionalText(payment.reference) ?? null,
      observations: null,
      concept: null,
      noteId: id,
    });
    const allocation = { campaignId: note.campaign.id, noteId: id, amount: total };
    ({ receiptNumber } = await savePayment(deps, record, [allocation], actor.id));
  }
  await deps.audit.record({
    actorId: actor.id,
    action: "sales.confirm",
    entityType: "delivery_note",
    entityId: id,
    payload: { number, total: total.toDecimalString(), paperNumber: Boolean(paperNumber), receiptNumber },
  });
  return { number, receiptNumber };
}

/**
 * Voiding keeps the note and its number and cancels its debt with reversing entries (D6). The
 * payment received with a cash note is voided with it; other payments applied to the note stay,
 * as a credit in the customer's favor.
 */
export async function voidNote(
  deps: Omit<NoteLifecycleDeps, "lookups" | "numbering" | "receipts">,
  actor: Actor,
  noteId: unknown,
  input: unknown,
): Promise<void> {
  assertCan(actor, "notes.void");
  const id = validateInput(z.uuid(), noteId);
  const { reason } = validateInput(voidNoteSchema, input);
  const note = await existingNote(deps.notes, id);
  if (note.status !== "confirmed") throw new DomainError("INVALID_STATE", { status: note.status });
  // Their credits would stay after the delivery is cancelled, so they go first.
  if ((await deps.notes.followUps(id)).some((followUp) => followUp.status === "confirmed")) {
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: { reason: ["Tiene devoluciones o traspasos confirmados; anúlalos primero."] },
    });
  }

  await deps.notes.markVoided(id, reason, actor.id);
  await reverseInLedger(deps.ledger, { type: "delivery_note", id }, deps.today(), actor.id);
  for (const paymentId of await deps.payments.settling(id)) {
    await cancelPayment(
      deps,
      paymentId,
      `Anulación de la boleta N.º ${note.number}: ${reason}`,
      deps.today(),
      actor.id,
    );
  }
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
