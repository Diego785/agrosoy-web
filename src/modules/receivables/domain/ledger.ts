import { DomainError } from "@/shared/domain/domain-error";
import type { Money } from "@/shared/domain/money";

export const LEDGER_KINDS = [
  "delivery",
  "return",
  "payment",
  "charge",
  "campaign_transfer_out",
  "campaign_transfer_in",
  "opening_balance",
] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export const LEDGER_SOURCE_TYPES = ["delivery_note", "payment", "charge", "import_batch"] as const;
export type LedgerSource = { type: (typeof LEDGER_SOURCE_TYPES)[number]; id: string };

/** Kinds that lower the debt. */
const CREDIT_KINDS: ReadonlySet<LedgerKind> = new Set(["return", "payment", "campaign_transfer_out"]);
/** These go either way, so their amount carries the sign: a customer can start in favor (opening balance), a price adjustment can lower the debt (D24). */
const SIGNED_KINDS: ReadonlySet<LedgerKind> = new Set(["opening_balance", "charge"]);

/** A line of the customer's debt: positive amounts are debits (they owe more), negative are credits. */
export type LedgerPosting = {
  customerId: string;
  campaignId: string;
  /** Business date (ISO, Bolivia time). */
  date: string;
  kind: LedgerKind;
  amount: Money;
  source: LedgerSource;
  /** Set on the entries a void writes; they keep the kind of the entry they cancel. */
  reversesEntryId: string | null;
};

export type LedgerEntry = LedgerPosting & { id: string };

/** Builds an entry from the document's (positive) amount; the kind decides whether it is a debit or a credit. */
export function posting(input: Omit<LedgerPosting, "reversesEntryId">): LedgerPosting {
  if (input.amount.isZero()) throw new DomainError("INVALID_AMOUNT", { reason: "zero_entry" });
  if (SIGNED_KINDS.has(input.kind)) return { ...input, reversesEntryId: null };
  if (input.amount.isNegative()) throw new DomainError("INVALID_AMOUNT", { reason: "negative_entry" });
  return {
    ...input,
    amount: CREDIT_KINDS.has(input.kind) ? input.amount.negate() : input.amount,
    reversesEntryId: null,
  };
}

/**
 * The entries that cancel a document's entries, dated the day of the void (D6). Entries that were
 * already reversed, and the reversals themselves, are left alone, so voiding twice adds nothing.
 */
export function reversalsOf(entries: readonly LedgerEntry[], date: string): LedgerPosting[] {
  const reversed = new Set(entries.flatMap((entry) => entry.reversesEntryId ?? []));
  return entries
    .filter((entry) => entry.reversesEntryId === null && !reversed.has(entry.id))
    .map((entry) => ({
      customerId: entry.customerId,
      campaignId: entry.campaignId,
      date,
      kind: entry.kind,
      amount: entry.amount.negate(),
      source: entry.source,
      reversesEntryId: entry.id,
    }));
}
