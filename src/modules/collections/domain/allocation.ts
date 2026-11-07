import { Money } from "@/shared/domain/money";

/** What a customer owes in one campaign, from the ledger. */
export type CampaignBalance = { campaignId: string; startsOn: string; balance: Money };

/** Where administration applies a payment (domain model, M6). */
export type AllocationTarget =
  | { kind: "oldest_debt" }
  | { kind: "campaign"; campaignId: string }
  | { kind: "note"; noteId: string; campaignId: string };

/** One credit entry of a payment, in US dollars. */
export type Allocation = { campaignId: string; noteId: string | null; amount: Money };

/**
 * Splits a payment into credits per campaign. "Oldest debt" pays campaigns in order of their start
 * until each is settled; whatever is left (an overpayment) stays as a credit in favor in
 * `fallbackCampaignId`, the campaign of the payment date.
 */
export function allocate(
  usdAmount: Money,
  target: AllocationTarget,
  balances: readonly CampaignBalance[],
  fallbackCampaignId: string,
): Allocation[] {
  if (target.kind === "campaign") return [{ campaignId: target.campaignId, noteId: null, amount: usdAmount }];
  if (target.kind === "note")
    return [{ campaignId: target.campaignId, noteId: target.noteId, amount: usdAmount }];

  const allocations: Allocation[] = [];
  let remaining = usdAmount;
  const owing = balances
    .filter((campaign) => campaign.balance.isPositive())
    .toSorted((a, b) => a.startsOn.localeCompare(b.startsOn));
  for (const campaign of owing) {
    if (!remaining.isPositive()) break;
    const amount = remaining.compare(campaign.balance) <= 0 ? remaining : campaign.balance;
    allocations.push({ campaignId: campaign.campaignId, noteId: null, amount });
    remaining = remaining.subtract(amount);
  }
  if (remaining.isPositive()) {
    const fallback = allocations.find((allocation) => allocation.campaignId === fallbackCampaignId);
    if (fallback) fallback.amount = fallback.amount.add(remaining);
    else allocations.push({ campaignId: fallbackCampaignId, noteId: null, amount: remaining });
  }
  return allocations;
}

export function allocatedTotal(allocations: readonly Allocation[]): Money {
  return Money.sum(allocations.map((allocation) => allocation.amount));
}
