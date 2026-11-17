import { z } from "zod";
import type { Actor } from "@/shared/application/actor";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { Money } from "@/shared/domain/money";
import { effectiveDueOn } from "@/modules/campaigns/domain/campaign";
import { splitDebt, standingEntries, type DebtSplit } from "@/modules/collections/domain/interest";
import { aging, withoutReversedPairs } from "../domain/aging";
import { overdueByCampaign, totalOverdue } from "../domain/overdue";
import { collectedPerMille, ledgerTotals } from "../domain/statement";
import type { LedgerRow, StatementCampaign, StatementExtension, StatementReader } from "./statement-ports";
import {
  agingView,
  totalsView,
  type CustomerStatementView,
  type PortfolioStatementView,
  type StatementLineView,
} from "./statement-view";

export type StatementDeps = {
  statements: StatementReader;
  /** Today's business date in Bolivia, to age the debt. */
  today: () => string;
};

export const portfolioFilterSchema = z.object({
  campaignId: z.uuid().optional().catch(undefined),
  /** A technician's customers; "all" for everyone. Technicians start on their own portfolio. */
  technicianId: z
    .union([z.literal("all"), z.uuid()])
    .optional()
    .catch(undefined),
  status: z.enum(["all", "owing"]).catch("all"),
});

export const customerStatementFilterSchema = z.object({
  campaignId: z.uuid().optional().catch(undefined),
});

const LEDGER_SOURCE: PortfolioStatementView["source"] = { label: "", campaignLabel: null, isPreview: false };

/** Every customer with entries, with the spreadsheet's columns and how much is older than 90 days. */
export async function portfolioStatement(
  deps: StatementDeps,
  actor: Actor,
  input: unknown,
): Promise<PortfolioStatementView & { campaigns: StatementCampaign[]; technicianId: string | null }> {
  assertCan(actor, "statements.view");
  const filter = validateInput(portfolioFilterSchema, input);
  const technicianId =
    filter.technicianId === "all"
      ? null
      : (filter.technicianId ?? (actor.role === "sales_technician" ? actor.id : null));

  const [entries, campaigns] = await Promise.all([
    deps.statements.entries({ campaignId: filter.campaignId, technicianId: technicianId ?? undefined }),
    deps.statements.campaigns(),
  ]);
  const byCustomer = Map.groupBy(entries, (entry) => entry.customerId);
  const [customers, extensions] = await Promise.all([
    deps.statements.customers([...byCustomer.keys()]),
    deps.statements.extensions([...byCustomer.keys()]),
  ]);
  const today = deps.today();
  const dueOf = dueDates(campaigns, extensions);

  const rows = customers
    .map((customer) => {
      const own = byCustomer.get(customer.id) ?? [];
      const totals = ledgerTotals(own.map(asMoney));
      const over90 = aging(withoutReversedPairs(own).map(asMoney), today).over90;
      const overdue = totalOverdue(
        overdueByCampaign(own.map(asMoney), (campaignId) => dueOf(customer.id, campaignId)?.dueOn, today),
      );
      return { key: customer.id, name: customer.name, totals, over90, overdue };
    })
    .filter((row) => filter.status === "all" || row.totals.status === "owing")
    .toSorted((a, b) => a.name.localeCompare(b.name, "es"));
  const totals = ledgerTotals(rows.flatMap((row) => (byCustomer.get(row.key) ?? []).map(asMoney)));

  return {
    source: LEDGER_SOURCE,
    customers: rows.map((row) => ({
      key: row.key,
      name: row.name,
      totals: totalsView(row.totals),
      over90: row.over90.isPositive() ? row.over90.toDecimalString() : null,
      overdue: row.overdue.isPositive() ? row.overdue.toDecimalString() : null,
    })),
    totals: totalsView(totals),
    collectedPerMille: collectedPerMille(totals),
    campaigns,
    technicianId,
  };
}

/** One customer's dated movements, their totals per campaign and the age of what they owe. */
export async function customerStatement(
  deps: StatementDeps,
  actor: Actor,
  customerId: unknown,
  input: unknown,
): Promise<CustomerStatementView & { customerId: string; campaigns: StatementCampaign[] }> {
  assertCan(actor, "statements.view");
  const id = validateInput(z.uuid(), customerId);
  const { campaignId } = validateInput(customerStatementFilterSchema, input);
  const [[customer], entries, campaigns, extensions] = await Promise.all([
    deps.statements.customers([id]),
    deps.statements.entries({ customerId: id, campaignId }),
    deps.statements.campaigns(),
    deps.statements.extensions([id]),
  ]);
  if (!customer) throw new DomainError("NOT_FOUND", { entity: "customer", id });

  const idsOf = (type: LedgerRow["source"]["type"]) => [
    ...new Set(entries.filter((entry) => entry.source.type === type).map((entry) => entry.source.id)),
  ];
  const [notes, payments, charges, openings] = await Promise.all([
    deps.statements.notes(idsOf("delivery_note")),
    deps.statements.payments(idsOf("payment")),
    deps.statements.charges(idsOf("charge")),
    deps.statements.openingBalances(idsOf("opening_balance")),
  ]);

  // Payments cover interest before capital (D45): each campaign's split, from its standing entries.
  const splits = new Map<string, DebtSplit>();
  const standing = standingEntries(
    entries.map((entry) => ({
      ...entry,
      amount: Money.parse(entry.amount),
      isInterest: entry.source.type === "charge" && charges.get(entry.source.id)?.concept === "interest",
    })),
  );
  for (const [campaignOfEntries, own] of Map.groupBy(standing, (entry) => entry.campaignId)) {
    splits.set(campaignOfEntries, splitDebt(own));
  }
  const interestPartOf = (entry: LedgerRow) => {
    const part = splits.get(entry.campaignId)?.payments.get(entry.id)?.toInterest;
    return part?.isPositive() ? part.toDecimalString() : null;
  };

  const lines = entries.flatMap((entry): StatementLineView[] => {
    const isReversal = entry.reversesEntryId !== null;
    const base = {
      date: entry.date,
      isReversal,
      document: null,
      noteNumber: null,
      description: "",
      packaging: null,
      quantity: null,
      unitPrice: null,
      freeOfCharge: null,
      exchangeRate: null,
      observation: null,
      invoiceNumber: null,
      receipt: null,
      transfer: null,
      fromSheet: entry.source.type === "import_batch",
    } satisfies Partial<StatementLineView>;

    if (entry.source.type === "delivery_note") {
      const note = notes.get(entry.source.id);
      const document = { type: "note" as const, id: entry.source.id };
      const noteFields = {
        noteNumber: note?.number ?? null,
        exchangeRate: note?.exchangeRate ?? null,
        document,
      };
      if (entry.kind === "campaign_transfer_out" || entry.kind === "campaign_transfer_in") {
        const transfer = entry.kind === "campaign_transfer_out" ? "out" : "in";
        return [{ ...base, ...noteFields, kind: "other", amount: signed(entry), transfer }];
      }
      // A voided note shows as one line that cancels it; deliveries and returns show their products.
      if (isReversal || !note || (entry.kind !== "delivery" && entry.kind !== "return")) {
        return [{ ...base, ...noteFields, kind: kindOf(entry), amount: signed(entry) }];
      }
      const kind = entry.kind;
      return note.lines.map((line, index) => ({
        ...base,
        ...noteFields,
        kind,
        description: line.productName,
        packaging: { content: line.content, unit: line.unit },
        quantity: line.quantity,
        unitPrice: line.freeOfCharge ? null : line.unitPrice,
        freeOfCharge: line.freeOfCharge,
        amount: line.total,
        observation: index === 0 ? note.observations : null,
        invoiceNumber: index === 0 && kind === "delivery" ? note.taxInvoiceNumber : null,
      }));
    }
    if (entry.source.type === "payment") {
      const payment = payments.get(entry.source.id);
      return [
        {
          ...base,
          kind: "payment",
          amount: signed(entry),
          interestPart: interestPartOf(entry),
          exchangeRate: payment?.exchangeRate ?? null,
          observation: payment?.reference ?? null,
          receipt: payment
            ? {
                number: payment.receiptNumber,
                method: payment.method,
                currency: payment.currency,
                amount: payment.amount,
                usdAmount: payment.usdAmount,
              }
            : null,
          document: { type: "payment", id: entry.source.id },
        },
      ];
    }
    if (entry.source.type === "charge") {
      return [
        {
          ...base,
          kind: "charge",
          amount: signed(entry),
          description: charges.get(entry.source.id)?.reason ?? "",
          chargeConcept: charges.get(entry.source.id)?.concept ?? null,
          document: { type: "charge", id: entry.source.id },
        },
      ];
    }
    if (entry.source.type === "opening_balance") {
      return [
        {
          ...base,
          kind: "other",
          amount: signed(entry),
          opening: { note: openings.get(entry.source.id)?.note ?? null },
        },
      ];
    }
    return [{ ...base, kind: kindOf(entry), amount: signed(entry) }];
  });

  const today = deps.today();
  const dueOf = dueDates(campaigns, extensions);
  const overdue = overdueByCampaign(
    entries.map(asMoney),
    (campaignOfEntry) => dueOf(customer.id, campaignOfEntry)?.dueOn,
    today,
  );
  const byCampaign = campaigns
    .filter((campaign) => entries.some((entry) => entry.campaignId === campaign.id))
    .map((campaign) => {
      const due = dueOf(customer.id, campaign.id)!;
      return {
        campaignId: campaign.id,
        season: campaign.season,
        year: campaign.year,
        totals: totalsView(
          ledgerTotals(entries.filter((entry) => entry.campaignId === campaign.id).map(asMoney)),
        ),
        dueOn: due.dueOn,
        campaignDueOn: campaign.dueOn,
        extension: due.extension,
        overdue: (overdue.get(campaign.id) ?? Money.zero()).toDecimalString(),
        interestOwed: (splits.get(campaign.id)?.interest ?? Money.zero()).toDecimalString(),
      };
    });

  return {
    source: LEDGER_SOURCE,
    customerId: customer.id,
    customerName: customer.name,
    lines,
    totals: totalsView(ledgerTotals(entries.map(asMoney))),
    byCampaign,
    aging: agingView(aging(withoutReversedPairs(entries).map(asMoney), today)),
    overdue: totalOverdue(overdue).toDecimalString(),
    campaigns,
  };
}

/**
 * When a customer's debt in a campaign falls due: their extension when it is later than the
 * campaign's date, otherwise the campaign's (D37).
 */
function dueDates(campaigns: readonly StatementCampaign[], extensions: readonly StatementExtension[]) {
  const campaignDue = new Map(campaigns.map((campaign) => [campaign.id, campaign.dueOn]));
  const extensionOf = new Map(
    extensions.map((extension) => [`${extension.customerId}|${extension.campaignId}`, extension]),
  );
  return (customerId: string, campaignId: string) => {
    const campaignDueOn = campaignDue.get(campaignId);
    if (!campaignDueOn) return undefined;
    const extension = extensionOf.get(`${customerId}|${campaignId}`);
    const dueOn = effectiveDueOn(campaignDueOn, extension?.dueOn);
    return {
      dueOn,
      extension:
        extension && dueOn === extension.dueOn ? { dueOn: extension.dueOn, reason: extension.reason } : null,
    };
  };
}

function asMoney<T extends { amount: string }>(entry: T): Omit<T, "amount"> & { amount: Money } {
  return { ...entry, amount: Money.parse(entry.amount) };
}

function kindOf(entry: LedgerRow): StatementLineView["kind"] {
  if (
    entry.kind === "delivery" ||
    entry.kind === "return" ||
    entry.kind === "payment" ||
    entry.kind === "charge"
  ) {
    return entry.kind;
  }
  return "other";
}

/** Statement lines show credits as positive amounts in their own column; reversals come out negative. */
function signed(entry: LedgerRow): string {
  const kind = kindOf(entry);
  const amount = Money.parse(entry.amount);
  return (kind === "payment" || kind === "return" ? amount.negate() : amount).toDecimalString();
}
