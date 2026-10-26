import { Money } from "@/shared/domain/money";
import { divideRoundingHalfUp } from "@/shared/domain/rounding";
import type { LedgerKind } from "./ledger";

export type StatementStatus = "settled" | "owing";

export type StatementTotals = {
  delivered: Money;
  paid: Money;
  returned: Money;
  /** Charges, opening balances and campaign transfers: what moves the debt besides the three columns. */
  other: Money;
  /** delivered + other − paid − returned: positive means the customer owes. */
  balance: Money;
  status: StatementStatus;
};

/**
 * The columns Agrosoy reads today in its spreadsheets: Entrega, Pago, Dev., Deuda and
 * "Cancelado"/"Debe". A customer who paid more than they owe also shows as settled, like the sheet.
 */
export function statementTotals(amounts: {
  delivered: Money[];
  paid: Money[];
  returned: Money[];
  other?: Money[];
}): StatementTotals {
  const delivered = Money.sum(amounts.delivered);
  const paid = Money.sum(amounts.paid);
  const returned = Money.sum(amounts.returned);
  const other = Money.sum(amounts.other ?? []);
  const balance = delivered.add(other).subtract(paid).subtract(returned);
  return {
    delivered,
    paid,
    returned,
    other,
    balance,
    status: balance.isPositive() ? "owing" : "settled",
  };
}

export function addTotals(all: readonly StatementTotals[]): StatementTotals {
  return statementTotals({
    delivered: all.map((totals) => totals.delivered),
    paid: all.map((totals) => totals.paid),
    returned: all.map((totals) => totals.returned),
    other: all.map((totals) => totals.other),
  });
}

/**
 * Statement columns from ledger entries. Credits are stored negative, so payments and returns are
 * negated into positive columns; reversals keep their kind, so a voided note nets out of
 * deliveries and a voided payment out of payments.
 */
export function ledgerTotals(entries: readonly { kind: LedgerKind; amount: Money }[]): StatementTotals {
  const of = (...kinds: LedgerKind[]) =>
    entries.filter((entry) => kinds.includes(entry.kind)).map((entry) => entry.amount);
  return statementTotals({
    delivered: of("delivery"),
    paid: of("payment").map((amount) => amount.negate()),
    returned: of("return").map((amount) => amount.negate()),
    other: of("charge", "opening_balance", "campaign_transfer_in", "campaign_transfer_out"),
  });
}

/** Share of net sales already collected, in tenths of a percent (67 = 6.7 %); null without sales. */
export function collectedPerMille(totals: StatementTotals): number | null {
  const netSales = totals.delivered.subtract(totals.returned);
  if (!netSales.isPositive()) return null;
  return Number(divideRoundingHalfUp(totals.paid.cents * 1000n, netSales.cents));
}
