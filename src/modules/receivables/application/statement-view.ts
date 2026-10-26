import type { Season } from "@/modules/campaigns/domain/campaign";
import type { ContentUnit } from "@/modules/catalog/domain/product";
import type { PaymentMethod } from "@/modules/collections/domain/payment";
import type { FreeReason } from "@/modules/sales/domain/delivery-note";
import type { Currency } from "@/shared/domain/money";
import type { Aging, AgingBucket } from "../domain/aging";
import type { StatementStatus, StatementTotals } from "../domain/statement";

// What the account-statement screens render. Plain data (decimal strings) so it crosses to the
// browser; produced from the ledger (M7) and, as a preview, from imported spreadsheets.

export type StatementTotalsView = {
  delivered: string;
  paid: string;
  returned: string;
  other: string;
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

export type AgingView = Record<AgingBucket, string>;

export type PortfolioStatementView = {
  source: StatementSource;
  customers: { key: string; name: string; totals: StatementTotalsView; over90: string | null }[];
  totals: StatementTotalsView;
  /** Tenths of a percent of net sales collected (67 = 6.7 %). */
  collectedPerMille: number | null;
};

/** Debit kinds raise the running balance; payments and returns lower it. */
export type StatementLineKind = "delivery" | "return" | "payment" | "charge" | "other";

export type StatementLineView = {
  kind: StatementLineKind;
  /** ISO date; null for spreadsheet payments, which carry no date. */
  date: string | null;
  noteNumber: number | null;
  /** The product of a note line, the reason of a charge; empty for undated spreadsheet rows. */
  description: string;
  packaging: { content: string; unit: ContentUnit } | null;
  quantity: string | null;
  unitPrice: string | null;
  freeOfCharge: FreeReason | null;
  /** Positive moves the balance the way its kind does; reversals are negative. */
  amount: string;
  exchangeRate: string | null;
  observation: string | null;
  receipt: { number: number; method: PaymentMethod; currency: Currency; amount: string } | null;
  /** The entry a void wrote to cancel a document. */
  isReversal: boolean;
  /** Campaign transfers: the credit in the old campaign ("out") or the charge in the new one ("in"). */
  transfer: "out" | "in" | null;
  /** Payments and returns brought in from a spreadsheet, which have no document of their own. */
  fromSheet: boolean;
  document: { type: "note" | "payment" | "charge"; id: string } | null;
};

export type CampaignTotalsView = {
  campaignId: string;
  season: Season;
  year: number;
  totals: StatementTotalsView;
};

export type CustomerStatementView = {
  source: StatementSource;
  customerName: string;
  lines: StatementLineView[];
  totals: StatementTotalsView;
  /** Ledger statements only. */
  byCampaign?: CampaignTotalsView[];
  aging?: AgingView;
};

export function totalsView(totals: StatementTotals): StatementTotalsView {
  return {
    delivered: totals.delivered.toDecimalString(),
    paid: totals.paid.toDecimalString(),
    returned: totals.returned.toDecimalString(),
    other: totals.other.toDecimalString(),
    balance: totals.balance.toDecimalString(),
    status: totals.status,
  };
}

export function agingView(result: Aging): AgingView {
  return {
    upTo30: result.upTo30.toDecimalString(),
    upTo60: result.upTo60.toDecimalString(),
    upTo90: result.upTo90.toDecimalString(),
    over90: result.over90.toDecimalString(),
  };
}

/** A spreadsheet or summary line with only the fields the preview knows. */
export function plainLine(
  line: Pick<StatementLineView, "kind" | "date" | "noteNumber" | "description" | "amount"> &
    Partial<StatementLineView>,
): StatementLineView {
  return {
    packaging: null,
    quantity: null,
    unitPrice: null,
    freeOfCharge: null,
    exchangeRate: null,
    observation: null,
    receipt: null,
    isReversal: false,
    transfer: null,
    fromSheet: false,
    document: null,
    ...line,
  };
}
