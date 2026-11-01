import { Money } from "@/shared/domain/money";
import { divideRoundingHalfUp } from "@/shared/domain/rounding";

export type StatementStatus = "settled" | "owing";

export type StatementTotals = {
  delivered: Money;
  paid: Money;
  returned: Money;
  /** delivered − paid − returned: positive means the customer owes. */
  balance: Money;
  status: StatementStatus;
};

/**
 * The columns Agrosoil reads today in its spreadsheets: Entrega, Pago, Dev., Deuda and
 * "Cancelado"/"Debe". A customer who paid more than they owe also shows as settled, like the sheet.
 */
export function statementTotals(amounts: {
  delivered: Money[];
  paid: Money[];
  returned: Money[];
}): StatementTotals {
  const delivered = Money.sum(amounts.delivered);
  const paid = Money.sum(amounts.paid);
  const returned = Money.sum(amounts.returned);
  const balance = delivered.subtract(paid).subtract(returned);
  return { delivered, paid, returned, balance, status: balance.isPositive() ? "owing" : "settled" };
}

export function addTotals(all: readonly StatementTotals[]): StatementTotals {
  return statementTotals({
    delivered: all.map((totals) => totals.delivered),
    paid: all.map((totals) => totals.paid),
    returned: all.map((totals) => totals.returned),
  });
}

/** Share of net sales already collected, in tenths of a percent (67 = 6.7 %); null without sales. */
export function collectedPerMille(totals: StatementTotals): number | null {
  const netSales = totals.delivered.subtract(totals.returned);
  if (!netSales.isPositive()) return null;
  return Number(divideRoundingHalfUp(totals.paid.cents * 1000n, netSales.cents));
}
