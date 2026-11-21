import { Money } from "@/shared/domain/money";

/**
 * What is still owed in each campaign whose due date has passed (D37). A campaign's balance counts
 * whole once today is after its due date (the customer's extension, if any); a balance in the
 * customer's favor is never overdue. Campaigns without a due date are left out.
 */
export function overdueByCampaign(
  entries: readonly { campaignId: string; amount: Money }[],
  dueOn: (campaignId: string) => string | undefined,
  today: string,
): Map<string, Money> {
  const balances = new Map<string, Money>();
  for (const entry of entries) {
    balances.set(entry.campaignId, (balances.get(entry.campaignId) ?? Money.zero()).add(entry.amount));
  }
  const overdue = new Map<string, Money>();
  for (const [campaignId, balance] of balances) {
    const due = dueOn(campaignId);
    if (due && today > due && balance.isPositive()) overdue.set(campaignId, balance);
  }
  return overdue;
}

export function totalOverdue(overdue: ReadonlyMap<string, Money>): Money {
  return Money.sum([...overdue.values()]);
}
