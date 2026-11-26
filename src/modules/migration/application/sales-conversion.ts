import { z } from "zod";
import type { LedgerRepository } from "@/modules/receivables/application/ledger-ports";
import { postToLedger, reverseInLedger } from "@/modules/receivables/application/ledger-service";
import { withoutReversedPairs } from "@/modules/receivables/domain/aging";
import {
  posting,
  reversalsOf,
  type LedgerKind,
  type LedgerPosting,
} from "@/modules/receivables/domain/ledger";
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
import { UnitPrice } from "@/shared/domain/unit-price";
import { parseProductLabel } from "../domain/product-label";
import type {
  CampaignLookup,
  CustomerRegistry,
  ProductRegistry,
  TechnicianOptions,
} from "./conversion-ports";
import { findBatch } from "./import-use-cases";
import { correctSheetEntrySchema } from "./sheet-entry-schemas";
import type { ImportBatch, ImportRepository, StoredLine } from "./ports";
import { sheetTotalsFor } from "./statement-preview";

export type SalesConversionDeps = {
  imports: ImportRepository;
  customers: Pick<CustomerRegistry, "findByKeys">;
  products: Pick<ProductRegistry, "findByKeys">;
  campaigns: CampaignLookup;
  /** The sheet's technician, chosen when its sales are passed (D47). */
  technicians: TechnicianOptions;
  notes: NoteRepository;
  ledger: LedgerRepository;
  /** What the conversion recorded per customer, for the reconciliation. */
  converted: {
    entries(
      batchId: string,
    ): Promise<
      { customerId: string; kind: LedgerKind; amount: Money; isReversal: boolean; createdAt: Date }[]
    >;
  };
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
  /** Whose sheet it is: its notes take this technician; empty keeps each customer's (D47). */
  technicianId: z.union([z.literal(""), z.uuid()]).default(""),
});

const undoSchema = z.object({
  batchId: z.uuid(),
  reason: z.string().trim().min(5, { error: "Explica por qué se deshace." }).max(500),
});

type Plan = {
  notes: Omit<ImportedNote, "importBatchId" | "campaignId">[];
  /** Returns and payments the sheet records without a note. */
  entries: { customerId: string; kind: "return" | "payment"; date: string; amount: Money }[];
  skipped: SkippedRow[];
};

/** What still has to be registered before the sheet's sales can be passed (D43). */
export type SalesReadiness = { missingCustomers: string[]; missingProducts: string[] };

/** The customers and products of the sheet that aren't in the system yet, as the sheet writes them. */
export async function salesReadiness(
  deps: Pick<SalesConversionDeps, "imports" | "customers" | "products">,
  actor: Actor,
  batchId: unknown,
): Promise<SalesReadiness> {
  assertCan(actor, "imports.manage");
  const batch = await findBatch(deps.imports, batchId);
  const { skipped } = await planSales(deps, batch, batch.salesConversion?.cutoffDate ?? "2000-01-01");
  return readinessOf(skipped);
}

function readinessOf(skipped: readonly SkippedRow[]): SalesReadiness {
  const labels = (reason: SkippedRow["reason"]) =>
    [...new Set(skipped.filter((row) => row.reason === reason).map((row) => row.label))].toSorted((a, b) =>
      a.localeCompare(b, "es"),
    );
  return { missingCustomers: labels("customer_missing"), missingProducts: labels("product_missing") };
}

/**
 * Turns the sheet's sales into confirmed notes marked as imported (keeping the sheet's numbers),
 * and its returns and payments into ledger entries, all in the chosen campaign (D22). Every customer
 * and product of the sheet must be in the system first: nothing is guessed and no row is left out,
 * so the conversion reconciles with the sheet (D43). Each note takes its customer's technician.
 * Imported notes take no stock: stock starts from a physical count.
 */
export async function convertSales(
  deps: SalesConversionDeps,
  actor: Actor,
  input: unknown,
): Promise<{ notes: number; entries: number }> {
  assertCan(actor, "imports.manage");
  const data = validateInput(convertSalesSchema, input);
  const batch = await findBatch(deps.imports, data.batchId);
  if (batch.salesConversion) throw new DomainError("INVALID_STATE", { reason: "already_converted" });
  const campaign = await deps.campaigns.find(data.campaignId);
  if (!campaign)
    throw new DomainError("VALIDATION_FAILED", { fieldErrors: { campaignId: ["Elige una campaña."] } });

  if (data.technicianId) {
    const active = await deps.technicians.listActive();
    if (!active.some((technician) => technician.id === data.technicianId)) {
      throw new DomainError("VALIDATION_FAILED", {
        fieldErrors: { technicianId: ["Elige un técnico de venta activo."] },
      });
    }
  }
  const plan = await planSales(deps, batch, data.cutoffDate, data.technicianId || null);
  if (plan.skipped.length > 0) {
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: { root: [missingMessage(readinessOf(plan.skipped))] },
    });
  }
  for (const note of plan.notes) {
    await recordImportedNote(deps, { ...note, importBatchId: batch.id, campaignId: campaign.id }, actor.id);
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
    },
  });
  return { notes: plan.notes.length, entries: postings.length };
}

/** "Faltan 2 clientes (…) y 1 producto (…)": what to register in the steps above first. */
function missingMessage({ missingCustomers, missingProducts }: SalesReadiness): string {
  const part = (items: string[], one: string, many: string) =>
    items.length === 0 ? null : `${items.length} ${items.length === 1 ? one : many} (${items.join(", ")})`;
  const parts = [
    part(missingCustomers, "cliente", "clientes"),
    part(missingProducts, "producto", "productos"),
  ].filter(Boolean);
  return `Faltan ${parts.join(" y ")} de la planilla. Pásalos en los pasos de arriba antes de pasar las ventas.`;
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
  /** Something of the customer's was corrected or voided after the conversion (D60): it explains a difference. */
  corrected: boolean;
};

/**
 * Each customer's debt as the sheet computes it (lines recomputed, payments from the summary) next
 * to what the conversion recorded (domain model, M12). No row is left out of a conversion (D43), so
 * a difference comes from what changed since, such as a customer renamed in the system.
 */
export async function salesReconciliation(
  deps: SalesConversionDeps,
  actor: Actor,
  batchId: unknown,
): Promise<{ batch: ImportBatch; rows: ReconciliationRow[] }> {
  assertCan(actor, "imports.manage");
  const batch = await findBatch(deps.imports, batchId);
  if (!batch.salesConversion) throw new DomainError("INVALID_STATE", { reason: "not_converted" });
  const convertedAt = batch.salesConversion.at;

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
        // Undoing a sheet reverses everything before it is passed again; only reversals written
        // since the last conversion are corrections or voids (D60).
        corrected: customer
          ? entries.some(
              (entry) =>
                entry.customerId === customer.id && entry.isReversal && entry.createdAt > convertedAt,
            )
          : false,
      };
    })
    .toSorted((a, b) => a.customerName.localeCompare(b.customerName, "es"));
  return { batch, rows };
}

async function planSales(
  deps: Pick<SalesConversionDeps, "imports" | "customers" | "products">,
  batch: ImportBatch,
  cutoffDate: string,
  sheetTechnicianId: string | null = null,
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
      // The sheet's own total when it has one, so each note adds up to what Excel shows (D60).
      return [
        {
          presentationId,
          quantity,
          unitPrice: UnitPrice.parse(line.unitPrice),
          total: Money.parse(line.total),
        },
      ];
    });
    if (noteLines.length === 0) continue;
    const rate = group.find((line) => line.exchangeRate)?.exchangeRate;
    const observations = [...new Set(group.flatMap((line) => line.observation ?? []))].join("; ");
    plan.notes.push({
      sheetNumber: first.noteNumber,
      noteDate: first.date ?? cutoffDate,
      customerId: customer.id,
      // A sheet is one technician's sales: its notes are theirs, whoever looks after the customer now.
      technicianId: sheetTechnicianId ?? customer.technicianId,
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

/** A payment or return a sheet brought in for a customer, as it stands now (D60). */
export type SheetEntry = { id: string; kind: "payment" | "return"; date: string; amount: string };

const SHEET_ENTRY_KINDS = new Set<LedgerKind>(["payment", "return"]);

/** What a converted sheet brought in for one customer besides notes: its payments and returns (D60). */
export async function sheetEntriesOf(
  deps: Pick<SalesConversionDeps, "imports" | "ledger">,
  actor: Actor,
  input: unknown,
): Promise<{ batch: ImportBatch; entries: SheetEntry[] }> {
  assertCan(actor, "imports.manage");
  const { batchId, customerId } = validateInput(z.object({ batchId: z.uuid(), customerId: z.uuid() }), input);
  const batch = await findBatch(deps.imports, batchId);
  if (!batch.salesConversion) throw new DomainError("INVALID_STATE", { reason: "not_converted" });
  const standing = withoutReversedPairs(await deps.ledger.entriesOf({ type: "import_batch", id: batch.id }));
  const entries = standing
    .filter((entry) => entry.customerId === customerId && SHEET_ENTRY_KINDS.has(entry.kind))
    .map((entry) => ({
      id: entry.id,
      kind: entry.kind as SheetEntry["kind"],
      date: entry.date,
      // Credits are stored negative; the sheet wrote them as amounts.
      amount: entry.amount.negate().toDecimalString(),
    }))
    .toSorted((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
  return { batch, entries };
}

/**
 * Administration corrects one payment or return a sheet brought in (D60), instead of undoing the
 * whole sheet: the entry is reversed and posted again with the new amount, the same date and kind;
 * zero leaves it out. The ledger stays append-only (D6).
 */
export async function correctSheetEntry(
  deps: Pick<SalesConversionDeps, "imports" | "ledger" | "audit">,
  actor: Actor,
  input: unknown,
): Promise<void> {
  assertCan(actor, "imports.manage");
  const data = validateInput(correctSheetEntrySchema, input);
  const batch = await findBatch(deps.imports, data.batchId);
  if (!batch.salesConversion) throw new DomainError("INVALID_STATE", { reason: "not_converted" });
  const source = { type: "import_batch" as const, id: batch.id };
  const entry = withoutReversedPairs(await deps.ledger.entriesOf(source)).find(
    (candidate) => candidate.id === data.entryId && SHEET_ENTRY_KINDS.has(candidate.kind),
  );
  if (!entry) throw new DomainError("NOT_FOUND", { entity: "ledger_entry", id: data.entryId });
  const before = entry.amount.negate();
  const after = Money.parse(data.amount);
  if (after.equals(before)) {
    throw new DomainError("VALIDATION_FAILED", { fieldErrors: { amount: ["Es el mismo monto."] } });
  }
  await postToLedger(
    deps.ledger,
    [
      ...reversalsOf([entry], entry.date),
      ...(after.isPositive()
        ? [
            posting({
              customerId: entry.customerId,
              campaignId: entry.campaignId,
              date: entry.date,
              kind: entry.kind,
              amount: after,
              source,
            }),
          ]
        : []),
    ],
    actor.id,
  );
  await deps.audit.record({
    actorId: actor.id,
    action: "migration.correct_sheet_entry",
    entityType: "import_batch",
    entityId: batch.id,
    payload: {
      sheetName: batch.sheetName,
      customerId: entry.customerId,
      kind: entry.kind,
      date: entry.date,
      amountBefore: before.toDecimalString(),
      amountAfter: after.toDecimalString(),
      reason: data.reason,
    },
  });
}
