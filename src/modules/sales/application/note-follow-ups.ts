import { z } from "zod";
import { postToLedger } from "@/modules/receivables/application/ledger-service";
import { posting, type LedgerPosting } from "@/modules/receivables/domain/ledger";
import type { Actor } from "@/shared/application/actor";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError, isDomainError } from "@/shared/domain/domain-error";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";
import { optionalText } from "@/shared/domain/text";
import {
  remaining,
  returnLines,
  transferLines,
  type FollowUpLine,
  type FollowUpNote,
} from "../domain/follow-up";
import type { NoteLifecycleDeps } from "./note-lifecycle";
import type { FollowUpItem, NoteView } from "./note-ports";
import { returnSchema, transferSchema } from "./note-schemas";

type FollowUpDeps = Omit<NoteLifecycleDeps, "payments" | "receipts" | "today">;

/** The domain's reasons, as the form shows them next to each quantity. */
const LINE_MESSAGES: Record<string, string> = {
  not_in_note: "Esa línea no es de la boleta.",
  exceeds_remaining: "Es más de lo que queda de esta línea.",
  no_lines: "Indica la cantidad de al menos un producto.",
  free_not_transferable: "Las bonificaciones y muestras no se pasan de campaña.",
};

/** The returns and transfers made against a delivery note, for its page. */
export async function listFollowUps(
  deps: Pick<FollowUpDeps, "notes">,
  actor: Actor,
  noteId: unknown,
): Promise<FollowUpItem[]> {
  assertCan(actor, "notes.view");
  return deps.notes.followUps(validateInput(z.uuid(), noteId));
}

/** A confirmed delivery note with what is left of each line, for the return and transfer forms. */
export async function followUpOptions(
  deps: Pick<FollowUpDeps, "notes">,
  actor: Actor,
  noteId: unknown,
): Promise<{ note: NoteView; remaining: Record<string, string> }> {
  assertCan(actor, "notes.manage");
  const note = await confirmedDelivery(deps.notes, validateInput(z.uuid(), noteId));
  const lines = await deps.notes.originalLines(note.id);
  return {
    note,
    remaining: Object.fromEntries(lines.map((line) => [line.id, remaining(line).toDecimalString()])),
  };
}

/**
 * Product brought back against a delivery note: credited at the price it was delivered for, in
 * the original note's campaign, on the day of the return. Stock comes back once inventory exists.
 */
export async function registerReturn(
  deps: FollowUpDeps,
  actor: Actor,
  noteId: unknown,
  input: unknown,
): Promise<{ id: string; number: number }> {
  assertCan(actor, "notes.manage");
  const original = await confirmedDelivery(deps.notes, validateInput(z.uuid(), noteId));
  const data = validateInput(returnSchema, input);
  await assertDateCanTakeDocuments(deps, original, data.noteDate);

  const lines = await linesOrFieldErrors(async () =>
    returnLines(
      await deps.notes.originalLines(original.id),
      data.lines.map((line) => ({
        originalLineId: line.originalLineId,
        quantity: Quantity.parse(line.quantity),
      })),
    ),
  );
  return saveFollowUp(deps, actor, data.paperNumber, {
    note: {
      ...followUpHeader(original, data),
      type: "return",
      campaignId: original.campaign.id,
      exchangeRate: ExchangeRate.parse(original.exchangeRate),
      receiver: { name: data.receiverName, documentId: null, relationship: null },
      lines,
    },
    postings: (id) => {
      const credit = Money.sum(lines.map((line) => line.total));
      return credit.isPositive()
        ? [ledgerLine(original, original.campaign.id, data.noteDate, "return", credit, id)]
        : [];
    },
  });
}

/**
 * Product the customer still holds moves to the campaign of the transfer date: credited at its
 * old price in the old campaign, charged at the new price in the new one (domain model, M5).
 */
export async function registerTransfer(
  deps: FollowUpDeps,
  actor: Actor,
  noteId: unknown,
  input: unknown,
): Promise<{ id: string; number: number }> {
  assertCan(actor, "notes.manage");
  const original = await confirmedDelivery(deps.notes, validateInput(z.uuid(), noteId));
  const data = validateInput(transferSchema, input);
  const campaign = await assertDateCanTakeDocuments(deps, original, data.noteDate);
  if (campaign.id === original.campaign.id) {
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: {
        noteDate: ["La fecha cae en la misma campaña de la boleta; elige una fecha de la nueva campaña."],
      },
    });
  }

  const lines = await linesOrFieldErrors(async () =>
    transferLines(
      await deps.notes.originalLines(original.id),
      data.lines.map((line) => ({
        originalLineId: line.originalLineId,
        quantity: Quantity.parse(line.quantity),
        unitPrice: Money.parse(line.unitPrice),
      })),
    ),
  );
  return saveFollowUp(deps, actor, data.paperNumber, {
    note: {
      ...followUpHeader(original, data),
      type: "campaign_transfer",
      campaignId: campaign.id,
      exchangeRate: ExchangeRate.parse(data.exchangeRate),
      receiver: { name: original.customer.name, documentId: null, relationship: null },
      lines,
    },
    postings: (id) => [
      ledgerLine(
        original,
        original.campaign.id,
        data.noteDate,
        "campaign_transfer_out",
        sumOf(lines, "originalTotal"),
        id,
      ),
      ledgerLine(original, campaign.id, data.noteDate, "campaign_transfer_in", sumOf(lines, "total"), id),
    ],
  });
}

async function saveFollowUp(
  deps: FollowUpDeps,
  actor: Actor,
  paperNumber: number | "",
  document: { note: FollowUpNote; postings: (id: string) => LedgerPosting[] },
): Promise<{ id: string; number: number }> {
  const { note } = document;
  if (paperNumber && (await deps.notes.numberInUse(paperNumber))) {
    throw new DomainError("DUPLICATE", { field: "paperNumber" });
  }
  const number = paperNumber || (await deps.numbering.take((candidate) => deps.notes.numberInUse(candidate)));
  const { id } = await deps.notes.insertFollowUp(note, number, actor.id);
  await postToLedger(deps.ledger, document.postings(id), actor.id);
  await deps.audit.record({
    actorId: actor.id,
    action: note.type === "return" ? "sales.register_return" : "sales.register_transfer",
    entityType: "delivery_note",
    entityId: id,
    payload: { number, originalNoteId: note.originalNoteId, lines: note.lines.length },
  });
  return { id, number };
}

function followUpHeader(
  original: NoteView,
  data: { noteDate: string; observations?: string },
): Omit<FollowUpNote, "type" | "campaignId" | "exchangeRate" | "receiver" | "lines"> {
  return {
    originalNoteId: original.id,
    noteDate: data.noteDate,
    customerId: original.customer.id,
    propertyId: original.property?.id ?? null,
    technicianId: original.technician?.id ?? null,
    paymentTerms: original.paymentTerms,
    // Who receives a return for Agrosoil and the carrier aren't asked yet; the form adds them later.
    handedOverById: null,
    carrier: { name: null, vehicle: null, documentId: null },
    observations: optionalText(data.observations) ?? null,
  };
}

function ledgerLine(
  original: NoteView,
  campaignId: string,
  date: string,
  kind: "return" | "campaign_transfer_out" | "campaign_transfer_in",
  amount: Money,
  noteId: string,
): LedgerPosting {
  return posting({
    customerId: original.customer.id,
    campaignId,
    date,
    kind,
    amount,
    source: { type: "delivery_note", id: noteId },
  });
}

function sumOf(lines: readonly FollowUpLine[], field: "total" | "originalTotal"): Money {
  return Money.sum(lines.map((line) => line[field]));
}

async function confirmedDelivery(notes: FollowUpDeps["notes"], id: string): Promise<NoteView> {
  const note = await notes.findById(id);
  if (!note) throw new DomainError("NOT_FOUND", { entity: "delivery_note", id });
  if (note.type !== "delivery" || note.status !== "confirmed") {
    throw new DomainError("INVALID_STATE", { type: note.type, status: note.status });
  }
  return note;
}

/** Returns and transfers are new documents: their date must fall in an open campaign, after the delivery. */
async function assertDateCanTakeDocuments(
  deps: Pick<FollowUpDeps, "lookups">,
  original: NoteView,
  isoDate: string,
): Promise<{ id: string }> {
  const campaign = await deps.lookups.campaignOn(isoDate);
  const message = !campaign
    ? "La fecha no cae en ninguna campaña."
    : campaign.status === "closed"
      ? "La campaña de esa fecha ya está cerrada."
      : isoDate < original.noteDate
        ? "La fecha es anterior a la entrega."
        : null;
  if (message || !campaign)
    throw new DomainError("VALIDATION_FAILED", { fieldErrors: { noteDate: [message ?? ""] } });
  return campaign;
}

/** Turns the domain's line codes into the messages shown next to each quantity. */
async function linesOrFieldErrors(build: () => Promise<FollowUpLine[]>): Promise<FollowUpLine[]> {
  try {
    return await build();
  } catch (error) {
    if (isDomainError(error) && error.code === "VALIDATION_FAILED") {
      const fieldErrors = (error.details.fieldErrors ?? {}) as Record<string, string[]>;
      throw new DomainError("VALIDATION_FAILED", {
        fieldErrors: Object.fromEntries(
          Object.entries(fieldErrors).map(([field, codes]) => [
            field === "lines" ? "root" : field,
            codes.map((code) => LINE_MESSAGES[code] ?? code),
          ]),
        ),
      });
    }
    throw error;
  }
}
