import type { LedgerKind } from "@/modules/receivables/domain/ledger";
import { DomainError } from "@/shared/domain/domain-error";
import { Money } from "@/shared/domain/money";
import { divideRoundingHalfUp } from "@/shared/domain/rounding";

/**
 * Late-payment interest as administration sets it (D38): the rate, the same for every customer; the
 * days after a due date before it runs; and the first day it may apply. Nothing is proposed until
 * that day is set, because debt imported from spreadsheets has its payments dated on the sheet's
 * cut-off (D22), so an older month would see the sales without the payments.
 */
export type InterestSettings = { ratePercent: string; graceDays: number; startsOn: string | null };

/** With 30 days, winter debt due on 30 November leaves December free and pays from January. */
export const DEFAULT_INTEREST_SETTINGS: InterestSettings = {
  ratePercent: "3",
  graceDays: 30,
  startsOn: null,
};

/** Hundredths of a percent: "3" is 300, "2.5" is 250. */
function basisPoints(ratePercent: string): bigint {
  const match = /^(\d{1,2})(?:\.(\d{1,2}))?$/.exec(ratePercent.trim());
  if (!match) throw new DomainError("VALIDATION_FAILED", { fieldErrors: { ratePercent: ["invalid"] } });
  return BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
}

/** The rate × the base, rounded half up to the cent. */
export function interestAmount(base: Money, ratePercent: string): Money {
  return Money.ofCents(divideRoundingHalfUp(base.cents * basisPoints(ratePercent), 10_000n));
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "2027-01" → "2027-02". */
export function nextMonth(month: string): string {
  const [year, number] = month.split("-").map(Number) as [number, number];
  return number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, "0")}`;
}

/** "2027-02" → "2027-02-28". */
export function lastDayOf(month: string): string {
  return addDays(`${nextMonth(month)}-01`, -1);
}

/** The first whole month in which interest runs: the one starting on or after the given day. */
export function firstMonthFrom(isoDate: string): string {
  const month = isoDate.slice(0, 7);
  return isoDate.endsWith("-01") ? month : nextMonth(month);
}

/** A ledger entry of the customer, as interest sees it. */
export type InterestEntry = {
  id: string;
  customerId: string;
  campaignId: string;
  date: string;
  kind: LedgerKind;
  amount: Money;
  /** Interest charged earlier: payments cover it first, and it never earns interest itself. */
  isInterest: boolean;
  /** Set on the entries a void writes (D6). */
  reversesEntryId: string | null;
};

/** Entries that still count: neither a void's reversal nor the entry it cancels. */
export function standingEntries<T extends { id: string; reversesEntryId: string | null }>(
  entries: readonly T[],
): T[] {
  const reversed = new Set(entries.flatMap((entry) => entry.reversesEntryId ?? []));
  return entries.filter((entry) => entry.reversesEntryId === null && !reversed.has(entry.id));
}

/** What a payment covered: the interest owed at the time first, the rest capital (D45). */
export type PaymentSplit = { toInterest: Money; toCapital: Money };

/** A customer's debt in one campaign, apart in capital and interest still owed. */
export type DebtSplit = {
  capital: Money;
  interest: Money;
  /** By the payment's ledger entry id. */
  payments: Map<string, PaymentSplit>;
};

/**
 * The debt of one customer in one campaign, from its standing entries in the order they happened,
 * up to a day if given (D45). Each payment covers the interest owed at the time before capital;
 * returns, transfers and adjustments only move capital. Capital below zero is money in favor.
 */
export function splitDebt(entries: readonly InterestEntry[], upTo?: string): DebtSplit {
  let capital = Money.zero();
  let interest = Money.zero();
  const payments = new Map<string, PaymentSplit>();
  for (const entry of entries) {
    if (upTo && entry.date > upTo) continue;
    if (entry.isInterest) {
      interest = interest.add(entry.amount);
    } else if (entry.kind === "payment" && entry.amount.isNegative()) {
      const paid = entry.amount.negate();
      const toInterest = !interest.isPositive() ? Money.zero() : paid.compare(interest) < 0 ? paid : interest;
      const toCapital = paid.subtract(toInterest);
      interest = interest.subtract(toInterest);
      capital = capital.subtract(toCapital);
      payments.set(entry.id, { toInterest, toCapital });
    } else {
      capital = capital.add(entry.amount);
    }
  }
  return { capital, interest, payments };
}

export type InterestProposal = {
  customerId: string;
  campaignId: string;
  /** The month whose interest it is, "2027-01"; with the customer and campaign, never charged twice. */
  month: string;
  /** The month's last day: the base is what was owed that day, and the charge is dated on it. */
  interestDate: string;
  /** The capital still owed at the end of the month, without interest. */
  base: Money;
  amount: Money;
};

export const proposalKey = (proposal: Pick<InterestProposal, "customerId" | "campaignId" | "month">) =>
  `${proposal.customerId}|${proposal.campaignId}|${proposal.month}`;

/**
 * The interest charges to propose today (D38): month by month. A customer's debt in a campaign runs
 * from the first whole month after its due date (or their extension) plus the grace days, and every
 * month that ends with capital owed earns the rate on that capital. A month is proposed once it has
 * ended, if it starts on or after the day interest starts and wasn't decided before. A month
 * proposed but not yet decided counts as charged for the next ones, so charging them together
 * gives what charging them one by one would.
 */
export function interestProposals(input: {
  campaigns: readonly { id: string; dueOn: string }[];
  /** In the order they happened. */
  entries: readonly InterestEntry[];
  /** The customer's later due date in a campaign, if they were given one (D37). */
  extensionOf: (customerId: string, campaignId: string) => string | undefined;
  /** Interest already charged or waived, by `proposalKey`. */
  decided: ReadonlySet<string>;
  settings: InterestSettings;
  today: string;
}): InterestProposal[] {
  const { settings, today } = input;
  const { startsOn } = settings;
  if (!startsOn) return [];
  const owedIn = Map.groupBy(
    standingEntries(input.entries),
    (entry) => `${entry.customerId}|${entry.campaignId}`,
  );
  const dueOn = new Map(input.campaigns.map((campaign) => [campaign.id, campaign.dueOn]));
  const proposals: InterestProposal[] = [];

  for (const entries of owedIn.values()) {
    const { customerId, campaignId } = entries[0]!;
    const campaignDue = dueOn.get(campaignId);
    if (!campaignDue) continue;
    const extension = input.extensionOf(customerId, campaignId);
    const due = extension && extension > campaignDue ? extension : campaignDue;
    const pending: InterestEntry[] = [];

    for (let month = firstMonthFrom(addDays(due, settings.graceDays + 1)); ; month = nextMonth(month)) {
      const interestDate = lastDayOf(month);
      if (interestDate >= today) break;
      if (`${month}-01` < startsOn) continue;
      const key = proposalKey({ customerId, campaignId, month });
      if (input.decided.has(key)) continue;
      const ledger = [...entries, ...pending].toSorted((a, b) => a.date.localeCompare(b.date));
      const base = splitDebt(ledger, interestDate).capital;
      if (!base.isPositive()) continue;
      const amount = interestAmount(base, settings.ratePercent);
      if (!amount.isPositive()) continue;
      proposals.push({ customerId, campaignId, month, interestDate, base, amount });
      pending.push({
        id: `pending:${key}`,
        customerId,
        campaignId,
        date: interestDate,
        kind: "charge",
        amount,
        isInterest: true,
        reversesEntryId: null,
      });
    }
  }
  return proposals.toSorted(
    (a, b) =>
      a.month.localeCompare(b.month) ||
      a.customerId.localeCompare(b.customerId) ||
      a.campaignId.localeCompare(b.campaignId),
  );
}

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2027-01" as "enero de 2027". */
export function monthName(month: string): string {
  const [year, number] = month.split("-").map(Number) as [number, number];
  return `${MONTHS[number - 1]} de ${year}`;
}

/** "1234567.5" as "1.234.567,50", for the charge's reason, which is stored text. */
function bolivianAmount(amount: Money): string {
  const [whole = "0", cents = "00"] = amount.toDecimalString().split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${cents}`;
}

/** The reason an interest charge carries, after its concept ("Interés: 3 % por mora de enero…", D38). */
export function interestReason(proposal: InterestProposal, ratePercent: string): string {
  const rate = ratePercent.replace(".", ",");
  return `${rate} % por mora de ${monthName(proposal.month)} sobre US$ ${bolivianAmount(proposal.base)}`;
}
