import type { LedgerRepository } from "@/modules/receivables/application/ledger-ports";
import { postToLedger, reverseInLedger } from "@/modules/receivables/application/ledger-service";
import { posting } from "@/modules/receivables/domain/ledger";
import { Money } from "@/shared/domain/money";
import type { ImportedNote } from "../domain/delivery-note";
import type { NoteRepository } from "./note-ports";

// How the migration module (M12) writes sales. Its use cases check `imports.manage` and run in one
// transaction with the rest of the conversion.

type ImportDeps = { notes: NoteRepository; ledger: LedgerRepository };

/** Saves a spreadsheet sale as a confirmed note and charges its total, like confirming one. */
export async function recordImportedNote(
  deps: ImportDeps,
  note: ImportedNote,
  actorId: string,
): Promise<{ id: string }> {
  const { id } = await deps.notes.insertImported(note, actorId);
  const total = Money.sum(note.lines.map((line) => line.total));
  if (total.isPositive()) {
    await postToLedger(
      deps.ledger,
      [
        posting({
          customerId: note.customerId,
          campaignId: note.campaignId,
          date: note.noteDate,
          kind: "delivery",
          amount: total,
          source: { type: "delivery_note", id },
        }),
      ],
      actorId,
    );
  }
  return { id };
}

/** Voids every note an import created, as when undoing that conversion. */
export async function voidImportedNotes(
  deps: ImportDeps,
  batchId: string,
  reason: string,
  date: string,
  actorId: string,
): Promise<number> {
  const notes = await deps.notes.importedFrom(batchId);
  for (const { id } of notes) {
    await deps.notes.markVoided(id, reason, actorId);
    await reverseInLedger(deps.ledger, { type: "delivery_note", id }, date, actorId);
  }
  return notes.length;
}
