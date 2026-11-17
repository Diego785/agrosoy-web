import { Money } from "@/shared/domain/money";
import type { LedgerKind } from "./ledger";

/** A standing ledger entry with what it takes to know whose sale it belongs to (D46). */
export type ShareEntry = {
  id: string;
  customerId: string;
  campaignId: string;
  date: string;
  kind: LedgerKind;
  /** Debits positive, credits negative. */
  amount: Money;
  /** Interest charged (D38): payments cover it before capital (D45). */
  isInterest: boolean;
  /** The note behind the entry, if any: a delivery, a return or a campaign transfer. */
  noteId: string | null;
  /** That note's technician. */
  noteTechnicianId: string | null;
  /** A payment applied by administration to one note (D20). */
  paidNoteId: string | null;
};

/** A piece of an entry that belongs to one technician; null is a customer without one. */
export type SharedEntry<T extends ShareEntry = ShareEntry> = T & { technicianId: string | null };

type Debt = { technicianId: string | null; noteId: string | null; isInterest: boolean; left: Money };

/**
 * Splits each customer's debt among the technicians who sold it (D46): a delivery and its returns
 * and transfers belong to the note's technician; charges and opening balances to the customer's
 * technician of today. A payment goes to the note administration chose, then to interest (D45),
 * then to the oldest debt; what is left over is the customer's money in favor, under today's
 * technician. Entries come in the order they happened, voids already left out.
 */
export function shareByTechnician<T extends ShareEntry>(
  entries: readonly T[],
  currentTechnicianOf: (customerId: string) => string | null,
): SharedEntry<T>[] {
  const shared: SharedEntry<T>[] = [];
  const groups = Map.groupBy(entries, (entry) => `${entry.customerId}|${entry.campaignId}`);

  for (const group of groups.values()) {
    const current = currentTechnicianOf(group[0]!.customerId);
    const debts: Debt[] = [];

    for (const entry of group) {
      const own = entry.noteId ? entry.noteTechnicianId : current;
      if (entry.amount.isPositive()) {
        debts.push({
          technicianId: own,
          noteId: entry.noteId,
          isInterest: entry.isInterest,
          left: entry.amount,
        });
        shared.push({ ...entry, technicianId: own });
        continue;
      }
      // A credit: settle debts in the order that applies to it, each piece under the debt's owner.
      let left = entry.amount.negate();
      const order =
        entry.kind === "payment"
          ? [
              ...debts.filter((debt) => entry.paidNoteId !== null && debt.noteId === entry.paidNoteId),
              ...debts.filter((debt) => debt.isInterest),
              ...debts.filter((debt) => !debt.isInterest),
            ]
          : [
              ...debts.filter((debt) => !debt.isInterest && debt.technicianId === own),
              ...debts.filter((debt) => !debt.isInterest && debt.technicianId !== own),
            ];
      const pieces = new Map<string | null, Money>();
      for (const debt of order) {
        if (!left.isPositive()) break;
        if (!debt.left.isPositive()) continue;
        const piece = left.compare(debt.left) < 0 ? left : debt.left;
        debt.left = debt.left.subtract(piece);
        left = left.subtract(piece);
        pieces.set(debt.technicianId, (pieces.get(debt.technicianId) ?? Money.zero()).add(piece));
      }
      if (left.isPositive()) {
        const inFavor = entry.kind === "payment" ? current : own;
        pieces.set(inFavor, (pieces.get(inFavor) ?? Money.zero()).add(left));
      }
      for (const [technicianId, piece] of pieces) {
        shared.push({ ...entry, amount: piece.negate(), technicianId });
      }
    }
  }
  return shared;
}
