import { DomainError } from "@/shared/domain/domain-error";
import { Money } from "@/shared/domain/money";
import { divideRoundingHalfUp } from "@/shared/domain/rounding";

/**
 * Late-payment interest as administration sets it (D38): the rate, the same for every customer; the
 * days after a due date before it applies; and the first day it may apply. Nothing is proposed until
 * that day is set, because debt imported from spreadsheets has its payments dated on the sheet's
 * cut-off (D22), so an older due date would see the sales without the payments.
 */
export type InterestSettings = { ratePercent: string; graceDays: number; startsOn: string | null };

export const DEFAULT_INTEREST_SETTINGS: InterestSettings = {
  ratePercent: "3",
  graceDays: 0,
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

/** A ledger entry of the customer, as interest sees it. */
export type InterestEntry = {
  id: string;
  customerId: string;
  campaignId: string;
  date: string;
  amount: Money;
  /** Interest charged earlier; it never earns interest itself. */
  isInterest: boolean;
  /** Set on the entries a void writes (D6). */
  reversesEntryId: string | null;
};

export type InterestProposal = {
  customerId: string;
  campaignId: string;
  /**
   * The campaign whose due date set it off: the debt's own campaign the first time, a later one each
   * time after. Interest is remembered by this, not by its day, which moves with extensions.
   */
  dueCampaignId: string;
  /** The day the interest applies: a due date plus the grace days. */
  interestDate: string;
  /** What was still owed in the campaign that day, without earlier interest. */
  base: Money;
  amount: Money;
};

export const proposalKey = (
  proposal: Pick<InterestProposal, "customerId" | "campaignId" | "dueCampaignId">,
) => `${proposal.customerId}|${proposal.campaignId}|${proposal.dueCampaignId}`;

/**
 * The interest charges to propose today (D38). A customer's debt in a campaign earns interest once
 * on that campaign's due date (or their extension) plus the grace days, and again each time a later
 * campaign falls due while it is still owed. The base is the campaign's balance that day without
 * earlier interest and without voided documents, which never were debt. Nothing is proposed for a
 * due date already decided, even if its day moved since (an extension, a changed due date or grace
 * days), before the day has passed, or before the day interest starts.
 */
export function interestProposals(input: {
  campaigns: readonly { id: string; dueOn: string }[];
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
  const reversed = new Set(input.entries.flatMap((entry) => entry.reversesEntryId ?? []));
  const standing = input.entries.filter((entry) => entry.reversesEntryId === null && !reversed.has(entry.id));
  const owedIn = Map.groupBy(standing, (entry) => `${entry.customerId}|${entry.campaignId}`);
  const dueOn = new Map(input.campaigns.map((campaign) => [campaign.id, campaign.dueOn]));
  const byDueDate = input.campaigns.toSorted(
    (a, b) => a.dueOn.localeCompare(b.dueOn) || a.id.localeCompare(b.id),
  );
  const proposals: InterestProposal[] = [];

  for (const entries of owedIn.values()) {
    const { customerId, campaignId } = entries[0]!;
    const campaignDue = dueOn.get(campaignId);
    if (!campaignDue) continue;
    const extension = input.extensionOf(customerId, campaignId);
    const first = addDays(extension && extension > campaignDue ? extension : campaignDue, settings.graceDays);
    const events = [{ dueCampaignId: campaignId, interestDate: first }];
    for (const later of byDueDate) {
      const interestDate = addDays(later.dueOn, settings.graceDays);
      // Two campaigns due the same day are one occasion, not two charges.
      if (later.dueOn <= campaignDue || interestDate <= first) continue;
      if (events.some((event) => event.interestDate === interestDate)) continue;
      events.push({ dueCampaignId: later.id, interestDate });
    }

    for (const { dueCampaignId, interestDate } of events) {
      if (interestDate < startsOn || interestDate >= today) continue;
      if (input.decided.has(proposalKey({ customerId, campaignId, dueCampaignId }))) continue;
      const base = Money.sum(
        entries
          .filter((entry) => !entry.isInterest && entry.date <= interestDate)
          .map((entry) => entry.amount),
      );
      if (!base.isPositive()) continue;
      proposals.push({
        customerId,
        campaignId,
        dueCampaignId,
        interestDate,
        base,
        amount: interestAmount(base, settings.ratePercent),
      });
    }
  }
  return proposals
    .filter((proposal) => proposal.amount.isPositive())
    .toSorted(
      (a, b) =>
        a.interestDate.localeCompare(b.interestDate) ||
        a.customerId.localeCompare(b.customerId) ||
        a.campaignId.localeCompare(b.campaignId),
    );
}

/** "1234567.5" as "1.234.567,50", for the charge's reason, which is stored text. */
function bolivianAmount(amount: Money): string {
  const [whole = "0", cents = "00"] = amount.toDecimalString().split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${cents}`;
}

/** The reason an interest charge carries, after its concept ("Interés: 3 % por mora sobre…", D38). */
export function interestReason(proposal: InterestProposal, ratePercent: string): string {
  const rate = ratePercent.replace(".", ",");
  const day = proposal.interestDate.split("-").toReversed().join("/");
  return `${rate} % por mora sobre US$ ${bolivianAmount(proposal.base)} adeudados al ${day}`;
}
