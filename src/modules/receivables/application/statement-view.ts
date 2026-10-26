import type { StatementStatus, StatementTotals } from "../domain/statement";

// What the account-statement screens render. Plain data (decimal strings) so it crosses to the
// browser; produced today from imported spreadsheets, and by the ledger once M7 is built.

export type StatementTotalsView = {
  delivered: string;
  paid: string;
  returned: string;
  balance: string;
  status: StatementStatus;
};

export type StatementSource = {
  /** Where the figures come from, e.g. the spreadsheet sheet name. */
  label: string;
  campaignLabel: string | null;
  /** True while the data comes from an imported spreadsheet instead of the system's own records. */
  isPreview: boolean;
};

export type PortfolioStatementView = {
  source: StatementSource;
  customers: { key: string; name: string; totals: StatementTotalsView }[];
  totals: StatementTotalsView;
  /** Tenths of a percent of net sales collected (67 = 6.7 %). */
  collectedPerMille: number | null;
};

export type StatementLineView = {
  kind: "delivery" | "return" | "payment";
  /** ISO date; null for spreadsheet payments, which carry no date. */
  date: string | null;
  noteNumber: number | null;
  description: string;
  quantity: string | null;
  unitPrice: string | null;
  amount: string;
  exchangeRate: string | null;
  observation: string | null;
};

export type CustomerStatementView = {
  source: StatementSource;
  customerName: string;
  lines: StatementLineView[];
  totals: StatementTotalsView;
};

export function totalsView(totals: StatementTotals): StatementTotalsView {
  return {
    delivered: totals.delivered.toDecimalString(),
    paid: totals.paid.toDecimalString(),
    returned: totals.returned.toDecimalString(),
    balance: totals.balance.toDecimalString(),
    status: totals.status,
  };
}
