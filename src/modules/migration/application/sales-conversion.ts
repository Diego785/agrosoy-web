import { z } from "zod";
import type { LedgerRepository } from "@/modules/receivables/application/ledger-ports";
import { postToLedger, reverseInLedger } from "@/modules/receivables/application/ledger-service";
import { posting, type LedgerKind, type LedgerPosting } from "@/modules/receivables/domain/ledger";
import { ledgerTotals, type StatementTotals } from "@/modules/receivables/domain/statement";
import { recordImportedNote, voidImportedNotes } from "@/modules/sales/application/note-imports";
import type { NoteRepository } from "@/modules/sales/application/note-ports";
import type { ImportedNote } from "@/modules/sales/domain/delivery-note";
import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";
import { parseProductLabel } from "../domain/product-label";
import type { CampaignLookup, CustomerRegistry, ProductRegistry } from "./conversion-ports";
import { findBatch } from "./import-use-cases";
import type { ImportBatch, ImportRepository, StoredLine } from "./ports";
import { sheetTotalsFor } from "./statement-preview";

export type SalesConversionDeps = {
  imports: ImportRepository;
  customers: Pick<CustomerRegistry, "findByKeys">;
  products: Pick<ProductRegistry, "findByKeys">;
  campaigns: CampaignLookup;
  notes: NoteRepository;
  ledger: LedgerRepository;
  /** What the conversion recorded per customer, for the reconciliation. */
  converted: { entries(batchId: string): Promise<{ customerId: string; kind: LedgerKind; amount: Money }[]> };
  audit: AuditTrail;
  /** Today's business date in Bolivia; undoing is dated the day it happens. */
  today: () => string;
};

/** A sheet row left out of the conversion, and why. */
export type SkippedRow = { row: number; reason: "customer_missing" | "product_missing"; label: string };

const convertSalesSchema = z.object({
  batchId: z.uuid(),
  campaignId: z.uuid({ error: "Elige la campaña de la planilla." }),
  cutoffDate: z.iso.date({ error: "Escribe la fecha de corte como dd/mm/aaaa." }),
  defaultExchangeRate: z
    .string()
    .trim()
    .transform((value) => value.replace(",", "."))
    .pipe(z.string().regex(/^\d+(\.\d{1,4})?$/, { error: "Escribe el tipo de cambio, por ejemplo 12.00." })),
});

const undoSchema = z.object({
  batchId: z.uuid(),
  reason: z.string().trim().min(5, { error: "Explica por qué se deshace." }).max(500),
});

type Plan = {
  /** The rate is null where the sheet left it blank; the conversion fills in its default. */
  notes: (Omit<ImportedNote, "importBatchId" | "campaignId" | "exchangeRate"> & {
    exchangeRate: ExchangeRate | null;
  })[];
  /** Returns and payments the sheet records without a note. */
  entries: { customerId: string; kind: "return" | "payment"; date: string; amount: Money }[];
  skipped: SkippedRow[];
};

/**
 * Turns the sheet's sales into confirmed notes marked as imported (keeping the sheet's numbers),
 * and its returns and payments into ledger entries, all in the chosen campaign (D22). Customers
 * and products must have been converted first; rows that still miss them are reported, not
 * guessed. Imported notes take no stock: stock starts from a physical count.
 */
export async function convertSales(
  deps: SalesConversionDeps,
  actor: Actor,
  input: unknown,
): Promise<{ notes: number; entries: number; skipped: SkippedRow[] }> {
  assertCan(actor, "imports.manage");
  const data = validateInput(convertSalesSchema, input);
  const batch = await findBatch(deps.imports, data.batchId);
  if (batch.salesConversion) throw new DomainError("INVALID_STATE", { reason: "already_converted" });
  const campaign = await deps.campaigns.find(data.campaignId);
  if (!campaign)
    throw new DomainError("VALIDATION_FAILED", { fieldErrors: { campaignId: ["Elige una campaña."] } });

  const plan = await planSales(deps, batch, data.cutoffDate);
  const defaultRate = ExchangeRate.parse(data.defaultExchangeRate);
  for (const note of plan.notes) {
    await recordImportedNote(
      deps,
      {
        ...note,
        exchangeRate: note.exchangeRate ?? defaultRate,
        importBatchId: batch.id,
        campaignId: campaign.id,
      },
      actor.id,
    );
  }
  const postings: LedgerPosting[] = plan.entries.map((entry) =>
    posting({
      customerId: entry.customerId,
      campaignId: campaign.id,
      date: entry.date,
      kind: entry.kind,
      amount: entry.amount,
      source: { type: "import_batch", id: batch.id },
    }),
  );
  await postToLedger(deps.ledger, postings, actor.id);
  await deps.imports.markSalesConverted(batch.id, {
    campaignId: campaign.id,
    cutoffDate: data.cutoffDate,
    actorId: actor.id,
  });
  await deps.audit.record({
    actorId: actor.id,
    action: "migration.convert_sales",
    entityType: "import_batch",
    entityId: batch.id,
    payload: {
      sheetName: batch.sheetName,
      notes: plan.notes.length,
      entries: postings.length,
      skipped: plan.skipped.length,
    },
  });
  return { notes: plan.notes.length, entries: postings.length, skipped: plan.skipped };
}

/** Voids the imported notes and reverses the sheet's entries, so the sheet can be fixed and converted again. */
export async function undoSalesConversion(
  deps: SalesConversionDeps,
  actor: Actor,
  input: unknown,
): Promise<{ voidedNotes: number }> {
  assertCan(actor, "imports.manage");
  const { batchId, reason } = validateInput(undoSchema, input);
  const batch = await findBatch(deps.imports, batchId);
  if (!batch.salesConversion) throw new DomainError("INVALID_STATE", { reason: "not_converted" });

  const today = deps.today();
  const voidedNotes = await voidImportedNotes(deps, batch.id, reason, today, actor.id);
  await reverseInLedger(deps.ledger, { type: "import_batch", id: batch.id }, today, actor.id);
  await deps.imports.clearSalesConversion(batch.id);
  await deps.audit.record({
    actorId: actor.id,
    action: "migration.undo_sales",
    entityType: "import_batch",
    entityId: batch.id,
    payload: { sheetName: batch.sheetName, voidedNotes, reason },
  });
  return { voidedNotes };
}

export type ReconciliationRow = {
  customerName: string;
  /** Null when the customer isn't in the system, so nothing of theirs was converted. */
  customerId: string | null;
  sheet: StatementTotals;
  converted: StatementTotals | null;
  /** Sheet debt minus converted debt; zero when they agree. */
  difference: Money;
};

/**
 * Each customer's debt as the sheet computes it (lines recomputed, payments from the summary) next
 * to what the conversion recorded, with the rows that were left out (domain model, M12).
 */
export async function salesReconciliation(
  deps: SalesConversionDeps,
  actor: Actor,
  batchId: unknown,
): Promise<{ batch: ImportBatch; rows: ReconciliationRow[]; skipped: SkippedRow[] }> {
  assertCan(actor, "imports.manage");
  const batch = await findBatch(deps.imports, batchId);
  if (!batch.salesConversion) throw new DomainError("INVALID_STATE", { reason: "not_converted" });

  const [lines, summary, entries] = await Promise.all([
    deps.imports.lines(batch.id),
    deps.imports.summary(batch.id),
    deps.converted.entries(batch.id),
  ]);
  const names = new Map<string, string>();
  for (const row of [...lines, ...summary])
    if (!names.has(row.customerKey)) names.set(row.customerKey, row.customerName);
  const customers = await deps.customers.findByKeys([...names.keys()]);

  const rows = [...names.entries()]
    .map(([key, name]): ReconciliationRow => {
      const sheet = sheetTotalsFor(key, lines, summary);
      const customer = customers.get(key);
      const converted = customer
        ? ledgerTotals(entries.filter((entry) => entry.customerId === customer.id))
        : null;
      return {
        customerName: customer?.name ?? name,
        customerId: customer?.id ?? null,
        sheet,
        converted,
        difference: sheet.balance.subtract(converted?.balance ?? Money.zero()),
      };
    })
    .toSorted((a, b) => a.customerName.localeCompare(b.customerName, "es"));

  // The skipped rows are worked out again the same way the conversion did.
  const { skipped } = await planSales(deps, batch, batch.salesConversion.cutoffDate);
  return { batch, rows, skipped };
}

async function planSales(
  deps: Pick<SalesConversionDeps, "imports" | "customers" | "products">,
  batch: ImportBatch,
  cutoffDate: string,
): Promise<Plan> {
  const [lines, summary] = await Promise.all([deps.imports.lines(batch.id), deps.imports.summary(batch.id)]);
  const customers = await deps.customers.findByKeys([
    ...new Set([...lines, ...summary].map((row) => row.customerKey)),
  ]);
  const presentationOf = await presentationResolver(deps, lines);
  const skipped: SkippedRow[] = [];
  const plan: Plan = { notes: [], entries: [], skipped };

  // One note per customer, written number and date, in the sheet's order.
  const groups = new Map<string, StoredLine[]>();
  for (const line of lines.filter((line) => line.kind === "delivery")) {
    const key = `${line.customerKey}|${line.noteNumber ?? ""}|${line.date ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  for (const group of groups.values()) {
    const [first] = group;
    const customer = first && customers.get(first.customerKey);
    if (!first || !customer) {
      for (const line of group)
        skipped.push({ row: line.row, reason: "customer_missing", label: line.customerName });
      continue;
    }
    const noteLines = group.flatMap((line) => {
      const presentationId = presentationOf(line.product);
      if (!presentationId) {
        skipped.push({ row: line.row, reason: "product_missing", label: line.product });
        return [];
      }
      const quantity = Quantity.parse(line.quantity);
      const unitPrice = Money.parse(line.unitPrice);
      return [{ presentationId, quantity, unitPrice, total: quantity.times(unitPrice) }];
    });
    if (noteLines.length === 0) continue;
    const rate = group.find((line) => line.exchangeRate)?.exchangeRate;
    const observations = [...new Set(group.flatMap((line) => line.observation ?? []))].join("; ");
    plan.notes.push({
      sheetNumber: first.noteNumber,
      noteDate: first.date ?? cutoffDate,
      customerId: customer.id,
      exchangeRate: rate ? ExchangeRate.parse(rate) : null,
      receiverName: customer.name,
      observations: observations || null,
      lines: noteLines,
    });
  }

  // Returns: the returns table when the sheet has one, otherwise the summary's "Dev." column.
  const returnLines = lines.filter((line) => line.kind === "return");
  for (const line of returnLines) {
    const customer = customers.get(line.customerKey);
    if (!customer) {
      skipped.push({ row: line.row, reason: "customer_missing", label: line.customerName });
      continue;
    }
    const amount = Money.parse(line.total);
    if (amount.isPositive())
      plan.entries.push({ customerId: customer.id, kind: "return", date: line.date ?? cutoffDate, amount });
  }
  for (const row of summary) {
    const customer = customers.get(row.customerKey);
    const paid = Money.parse(row.paid);
    const returned = Money.parse(row.returned);
    if (!customer) {
      if (paid.isPositive() || returned.isPositive()) {
        skipped.push({ row: row.row, reason: "customer_missing", label: row.customerName });
      }
      continue;
    }
    if (returnLines.length === 0 && returned.isPositive()) {
      plan.entries.push({ customerId: customer.id, kind: "return", date: cutoffDate, amount: returned });
    }
    if (paid.isPositive())
      plan.entries.push({ customerId: customer.id, kind: "payment", date: cutoffDate, amount: paid });
  }
  return plan;
}

/** Product label as written ("Fulvin 40-22 (20lts.)") → the presentation converted for it. */
async function presentationResolver(
  deps: Pick<SalesConversionDeps, "products">,
  lines: readonly StoredLine[],
): Promise<(label: string) => string | undefined> {
  const parsed = new Map(
    [...new Set(lines.map((line) => line.product))].map((label) => [label, parseProductLabel(label)]),
  );
  const products = await deps.products.findByKeys([
    ...new Set([...parsed.values()].flatMap((product) => (product ? [product.key] : []))),
  ]);
  return (label) => {
    const product = parsed.get(label);
    if (!product) return undefined;
    const content = Quantity.parse(product.content).toDecimalString();
    return products
      .get(product.key)
      ?.presentations.find(
        (presentation) => presentation.unit === product.unit && presentation.content === content,
      )?.id;
  };
}
