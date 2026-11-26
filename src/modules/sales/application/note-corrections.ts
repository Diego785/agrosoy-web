import { z } from "zod";
import { postToLedger, reverseInLedger } from "@/modules/receivables/application/ledger-service";
import type { LedgerRepository } from "@/modules/receivables/application/ledger-ports";
import { posting } from "@/modules/receivables/domain/ledger";
import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import { can, assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";
import { UnitPrice } from "@/shared/domain/unit-price";
import type { CorrectedLine, NoteRepository, NoteView } from "./note-ports";
import { noteReference } from "./note-lifecycle";
import { correctImportedNoteSchema } from "./note-schemas";

export type NoteCorrectionDeps = {
  notes: NoteRepository;
  ledger: LedgerRepository;
  audit: AuditTrail;
};

/** Only a confirmed delivery brought in from a sheet is corrected; whoever imports does it (D60). */
export function canCorrectImportedNote(
  actor: Actor,
  note: Pick<NoteView, "type" | "status" | "imported">,
): boolean {
  return (
    note.type === "delivery" &&
    note.status === "confirmed" &&
    note.imported !== null &&
    can(actor, "imports.manage")
  );
}

/**
 * Administration corrects the prices or quantities a sheet brought in for one note, with a reason
 * (D60), instead of undoing the whole sheet. The note keeps its sheet number; its debt follows from
 * the note's own date, so balances and interest from then on use the corrected amount. The ledger
 * stays append-only (D6): the old entry is reversed and the new total posted.
 */
export async function correctImportedNote(
  deps: NoteCorrectionDeps,
  actor: Actor,
  noteId: unknown,
  input: unknown,
): Promise<void> {
  assertCan(actor, "imports.manage");
  const id = validateInput(z.uuid(), noteId);
  const data = validateInput(correctImportedNoteSchema, input);
  const note = await deps.notes.findById(id);
  if (!note) throw new DomainError("NOT_FOUND", { entity: "delivery_note", id });
  if (!canCorrectImportedNote(actor, note)) throw new DomainError("INVALID_STATE", { status: note.status });
  // A return or transfer already took these lines at their price; it would no longer match.
  if ((await deps.notes.followUps(id)).some((followUp) => followUp.status === "confirmed")) {
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: { reason: ["Tiene devoluciones o traspasos confirmados; anúlalos primero."] },
    });
  }

  const fieldErrors: Record<string, string[]> = {};
  const changes: (CorrectedLine & {
    productName: string;
    before: { quantity: string; unitPrice: string };
  })[] = [];
  data.lines.forEach((requested, index) => {
    const line = note.lines.find((candidate) => candidate.id === requested.lineId);
    if (!line) throw new DomainError("NOT_FOUND", { entity: "delivery_note_line", id: requested.lineId });
    const quantity = Quantity.parse(requested.quantity);
    const unitPrice = UnitPrice.parse(requested.unitPrice);
    if (!quantity.isPositive())
      fieldErrors[`lines.${index}.quantity`] = ["La cantidad debe ser mayor que 0."];
    if (!line.freeOfCharge && !unitPrice.isPositive())
      fieldErrors[`lines.${index}.unitPrice`] = ["Escribe el precio."];
    const same =
      quantity.compare(Quantity.parse(line.quantity)) === 0 &&
      unitPrice.equals(UnitPrice.parse(line.unitPrice));
    if (same) return;
    changes.push({
      id: line.id,
      quantity,
      unitPrice,
      total: line.freeOfCharge ? Money.zero() : quantity.times(unitPrice),
      productName: line.productName,
      before: { quantity: line.quantity, unitPrice: line.unitPrice },
    });
  });
  if (Object.keys(fieldErrors).length > 0) throw new DomainError("VALIDATION_FAILED", { fieldErrors });
  if (changes.length === 0) {
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: { root: ["No cambiaste ningún precio ni cantidad."] },
    });
  }

  const before = Money.sum(note.lines.map((line) => Money.parse(line.total)));
  const changed = new Map(changes.map((change) => [change.id, change.total]));
  // Lines not corrected keep the total they came with: the sheet's own (D60).
  const after = Money.sum(note.lines.map((line) => changed.get(line.id) ?? Money.parse(line.total)));
  await deps.notes.correctLines(id, changes, data.reason, actor.id);
  const source = { type: "delivery_note" as const, id };
  await reverseInLedger(deps.ledger, source, note.noteDate, actor.id);
  if (after.isPositive()) {
    await postToLedger(
      deps.ledger,
      [
        posting({
          customerId: note.customer.id,
          campaignId: note.campaign.id,
          date: note.noteDate,
          kind: "delivery",
          amount: after,
          source,
        }),
      ],
      actor.id,
    );
  }
  await deps.audit.record({
    actorId: actor.id,
    action: "sales.correct_imported_note",
    entityType: "delivery_note",
    entityId: id,
    payload: {
      name: `${noteReference(note)} de ${note.customer.name}`,
      sheetNumber: note.imported?.sheetNumber ?? null,
      customer: note.customer.name,
      reason: data.reason,
      totalBefore: before.toDecimalString(),
      totalAfter: after.toDecimalString(),
      lines: changes.map((change) => ({
        product: change.productName,
        quantityBefore: change.before.quantity,
        quantityAfter: change.quantity.toDecimalString(),
        unitPriceBefore: change.before.unitPrice,
        unitPriceAfter: change.unitPrice.toDecimalString(),
      })),
    },
  });
}
