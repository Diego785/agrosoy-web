import { Money } from "@/shared/domain/money";

export const AGING_BUCKETS = ["upTo30", "upTo60", "upTo90", "over90"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];
export type Aging = Record<AgingBucket, Money>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between two ISO dates. */
export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  return Math.round((Date.parse(`${toIsoDate}T00:00:00Z`) - Date.parse(`${fromIsoDate}T00:00:00Z`)) / DAY_MS);
}

function bucketOf(days: number): AgingBucket {
  if (days <= 30) return "upTo30";
  if (days <= 60) return "upTo60";
  if (days <= 90) return "upTo90";
  return "over90";
}

/**
 * How old the unpaid debt is (domain model, M7): credits pay the oldest debits first, and what is
 * left of each debit is aged from its date. Pass entries without voided documents, whose debits
 * and reversals would otherwise pair up with other documents.
 */
export function aging(entries: readonly { date: string; amount: Money }[], today: string): Aging {
  const debits = entries
    .filter((entry) => entry.amount.isPositive())
    .toSorted((a, b) => a.date.localeCompare(b.date));
  let credit = Money.sum(
    entries.filter((entry) => entry.amount.isNegative()).map((entry) => entry.amount.negate()),
  );

  const result: Aging = {
    upTo30: Money.zero(),
    upTo60: Money.zero(),
    upTo90: Money.zero(),
    over90: Money.zero(),
  };
  for (const debit of debits) {
    const covered = credit.compare(debit.amount) >= 0 ? debit.amount : credit;
    credit = credit.subtract(covered);
    const unpaid = debit.amount.subtract(covered);
    if (unpaid.isPositive()) {
      const bucket = bucketOf(daysBetween(debit.date, today));
      result[bucket] = result[bucket].add(unpaid);
    }
  }
  return result;
}

/** Drops every entry of a voided document together with its reversal, for aging. */
export function withoutReversedPairs<T extends { id: string; reversesEntryId: string | null }>(
  entries: readonly T[],
): T[] {
  const reversed = new Set(entries.flatMap((entry) => entry.reversesEntryId ?? []));
  return entries.filter((entry) => entry.reversesEntryId === null && !reversed.has(entry.id));
}
