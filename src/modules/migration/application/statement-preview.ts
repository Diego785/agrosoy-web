import type { Actor } from "@/shared/application/actor";
import { assertCan } from "@/shared/application/permissions";
import { DomainError } from "@/shared/domain/domain-error";
import { Money } from "@/shared/domain/money";
import {
  totalsView,
  type CustomerStatementView,
  type PortfolioStatementView,
  type StatementLineView,
  type StatementSource,
} from "@/modules/receivables/application/statement-view";
import {
  addTotals,
  collectedPerMille,
  statementTotals,
  type StatementTotals,
} from "@/modules/receivables/domain/statement";
import { findBatch } from "./import-use-cases";
import type { ImportBatch, ImportRepository, StoredLine, StoredSummaryRow } from "./ports";

/**
 * Account statements built from an imported sheet, so Agrosoy can validate the format with real
 * figures before the ledger exists (roadmap, week 1). Payments come from the sheet's summary,
 * which has no dates; returns come from the returns table, or from the summary's "Dev." column.
 */
export async function portfolioStatementFromImport(
  deps: { imports: ImportRepository },
  actor: Actor,
  batchId: unknown,
): Promise<PortfolioStatementView> {
  assertCan(actor, "statements.view");
  const batch = await findBatch(deps.imports, batchId);
  const [lines, summary] = await Promise.all([deps.imports.lines(batch.id), deps.imports.summary(batch.id)]);

  const customers = customerNames(lines, summary).map(([key, name]) => ({
    key,
    name,
    totals: totalsFor(key, lines, summary),
  }));
  customers.sort((a, b) => a.name.localeCompare(b.name, "es"));
  const totals = addTotals(customers.map((customer) => customer.totals));

  return {
    source: sourceOf(batch),
    customers: customers.map((customer) => ({ ...customer, totals: totalsView(customer.totals) })),
    totals: totalsView(totals),
    collectedPerMille: collectedPerMille(totals),
  };
}

export async function customerStatementFromImport(
  deps: { imports: ImportRepository },
  actor: Actor,
  batchId: unknown,
  customerKey: string,
): Promise<CustomerStatementView> {
  assertCan(actor, "statements.view");
  const batch = await findBatch(deps.imports, batchId);
  const [lines, summary] = await Promise.all([
    deps.imports.lines(batch.id, customerKey),
    deps.imports.summary(batch.id, customerKey),
  ]);
  const name = customerNames(lines, summary)[0]?.[1];
  if (!name) throw new DomainError("NOT_FOUND", { entity: "customer", customerKey });

  return {
    source: sourceOf(batch),
    customerName: name,
    lines: statementLines(lines, summary),
    totals: totalsView(totalsFor(customerKey, lines, summary)),
  };
}

function totalsFor(key: string, lines: StoredLine[], summary: StoredSummaryRow[]): StatementTotals {
  const own = lines.filter((line) => line.customerKey === key);
  const ownSummary = summary.filter((row) => row.customerKey === key);
  const returnLines = own.filter((line) => line.kind === "return");
  return statementTotals({
    delivered: own.filter((line) => line.kind === "delivery").map((line) => Money.parse(line.total)),
    paid: ownSummary.map((row) => Money.parse(row.paid)),
    returned:
      returnLines.length > 0
        ? returnLines.map((line) => Money.parse(line.total))
        : ownSummary.map((row) => Money.parse(row.returned)),
  });
}

function statementLines(lines: StoredLine[], summary: StoredSummaryRow[]): StatementLineView[] {
  const dated: StatementLineView[] = [...lines]
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.row - b.row)
    .map((line) => ({
      kind: line.kind,
      date: line.date,
      noteNumber: line.noteNumber,
      description: line.product,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.total,
      exchangeRate: line.exchangeRate,
      observation: line.observation,
    }));

  const undated: StatementLineView[] = [];
  const hasReturnLines = lines.some((line) => line.kind === "return");
  for (const row of summary) {
    if (!hasReturnLines && Money.parse(row.returned).isPositive())
      undated.push(undatedLine("return", row.returned));
    if (Money.parse(row.paid).isPositive()) undated.push(undatedLine("payment", row.paid));
  }
  return [...dated, ...undated];
}

function undatedLine(kind: "return" | "payment", amount: string): StatementLineView {
  return {
    kind,
    date: null,
    noteNumber: null,
    description: "",
    quantity: null,
    unitPrice: null,
    amount,
    exchangeRate: null,
    observation: null,
  };
}

/** Every customer that appears in the lines or in the summary, with the name as first written. */
function customerNames(lines: StoredLine[], summary: StoredSummaryRow[]): [string, string][] {
  const names = new Map<string, string>();
  for (const line of lines) if (!names.has(line.customerKey)) names.set(line.customerKey, line.customerName);
  for (const row of summary) if (!names.has(row.customerKey)) names.set(row.customerKey, row.customerName);
  return [...names.entries()];
}

function sourceOf(batch: ImportBatch): StatementSource {
  return { label: batch.sheetName, campaignLabel: batch.campaignLabel, isPreview: true };
}
