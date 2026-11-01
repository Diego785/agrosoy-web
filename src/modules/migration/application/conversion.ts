import { z } from "zod";
import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { Quantity } from "@/shared/domain/quantity";
import { normalizeForComparison } from "@/shared/domain/text";
import { parseProductLabel, type ParsedProductLabel } from "../domain/product-label";
import type {
  CustomerRegistry,
  ExistingCustomer,
  PresentationSpec,
  ProductRegistry,
  TechnicianOptions,
} from "./conversion-ports";
import { findBatch } from "./import-use-cases";
import type { ImportBatch, ImportRepository } from "./ports";

export type ConversionDeps = {
  imports: ImportRepository;
  customers: CustomerRegistry;
  products: ProductRegistry;
  technicians: TechnicianOptions;
  audit: AuditTrail;
};

export type ProductGroup = {
  key: string;
  name: string;
  existingId: string | null;
  presentations: { content: string; unit: PresentationSpec["unit"]; exists: boolean; labels: string[] }[];
};

export type ConversionPreview = {
  batch: ImportBatch;
  customers: { key: string; name: string; existing: ExistingCustomer | null }[];
  technicians: { id: string; name: string }[];
  /** The technician whose name appears in the sheet name ("Ing. Favio Añez"), if any. */
  suggestedTechnicianId: string | null;
  products: ProductGroup[];
  unreadableProducts: string[];
};

/** What converting a sheet would create, so administration can decide before anything is written. */
export async function conversionPreview(
  deps: ConversionDeps,
  actor: Actor,
  batchId: unknown,
): Promise<ConversionPreview> {
  assertCan(actor, "imports.manage");
  const batch = await findBatch(deps.imports, batchId);
  const [customers, products, technicians] = await Promise.all([
    customerCandidates(deps, batch.id),
    productCandidates(deps, batch.id),
    deps.technicians.listActive(),
  ]);
  const sheetKey = normalizeForComparison(batch.sheetName);
  const suggested = technicians.find((technician) =>
    sheetKey.includes(normalizeForComparison(technician.name)),
  );
  return { batch, customers, technicians, suggestedTechnicianId: suggested?.id ?? null, ...products };
}

const convertCustomersSchema = z.object({
  batchId: z.uuid(),
  technicianId: z.union([z.literal(""), z.uuid()]),
});

/** Registers the sheet's customers that don't exist yet; running it again creates nothing new. */
export async function convertCustomers(
  deps: ConversionDeps,
  actor: Actor,
  input: unknown,
): Promise<{ created: number }> {
  assertCan(actor, "imports.manage");
  const { batchId, technicianId } = validateInput(convertCustomersSchema, input);
  const batch = await findBatch(deps.imports, batchId);
  const missing = (await customerCandidates(deps, batch.id)).filter((customer) => !customer.existing);

  for (const customer of missing) {
    await deps.customers.register({ name: customer.name, technicianId: technicianId || null });
  }
  await deps.audit.record({
    actorId: actor.id,
    action: "migration.convert_customers",
    entityType: "import_batch",
    entityId: batch.id,
    payload: { sheetName: batch.sheetName, created: missing.length },
  });
  return { created: missing.length };
}

const convertProductsSchema = z.object({
  batchId: z.uuid(),
  decisions: z.array(
    z.object({
      key: z.string().min(1),
      line: z.enum(["agrochemicals", "fertilizers"]).optional(),
      saleUnit: z.enum(["container", "measure"]),
    }),
  ),
});

/**
 * Creates the sheet's new products and adds missing presentations to existing ones. Each needs a
 * decision (line for new products, and how it is charged), because the spreadsheet doesn't say.
 */
export async function convertProducts(
  deps: ConversionDeps,
  actor: Actor,
  input: unknown,
): Promise<{ createdProducts: number; addedPresentations: number; skipped: string[] }> {
  assertCan(actor, "imports.manage");
  const { batchId, decisions } = validateInput(convertProductsSchema, input);
  const batch = await findBatch(deps.imports, batchId);
  const { products } = await productCandidates(deps, batch.id);
  const decisionFor = new Map(decisions.map((decision) => [decision.key, decision]));

  let createdProducts = 0;
  let addedPresentations = 0;
  const skipped: string[] = [];
  for (const group of products) {
    const missing = group.presentations.filter((presentation) => !presentation.exists);
    if (missing.length === 0) continue;
    const decision = decisionFor.get(group.key);
    if (!decision || (!group.existingId && !decision.line)) {
      skipped.push(group.name);
      continue;
    }
    const specs = missing.map(({ content, unit }) => ({ content, unit, saleUnit: decision.saleUnit }));
    if (group.existingId) {
      for (const spec of specs) await deps.products.addPresentation(group.existingId, spec);
      addedPresentations += specs.length;
    } else {
      await deps.products.create({ name: group.name, line: decision.line!, presentations: specs });
      createdProducts += 1;
    }
  }
  await deps.audit.record({
    actorId: actor.id,
    action: "migration.convert_products",
    entityType: "import_batch",
    entityId: batch.id,
    payload: { sheetName: batch.sheetName, createdProducts, addedPresentations, skipped },
  });
  return { createdProducts, addedPresentations, skipped };
}

async function customerCandidates(deps: Pick<ConversionDeps, "imports" | "customers">, batchId: string) {
  const [lines, summary] = await Promise.all([deps.imports.lines(batchId), deps.imports.summary(batchId)]);
  const names = new Map<string, string>();
  for (const row of [...lines, ...summary])
    if (!names.has(row.customerKey)) names.set(row.customerKey, row.customerName);
  const existing = await deps.customers.findByKeys([...names.keys()]);
  return [...names.entries()]
    .map(([key, name]) => ({ key, name, existing: existing.get(key) ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

async function productCandidates(deps: Pick<ConversionDeps, "imports" | "products">, batchId: string) {
  const lines = await deps.imports.lines(batchId);
  const labels = [...new Set(lines.map((line) => line.product))];
  const timesWritten = new Map<string, number>();
  for (const line of lines) timesWritten.set(line.product, (timesWritten.get(line.product) ?? 0) + 1);
  const parsed: { label: string; product: ParsedProductLabel }[] = [];
  const unreadableProducts: string[] = [];
  for (const label of labels) {
    const product = parseProductLabel(label);
    if (product) parsed.push({ label, product });
    else unreadableProducts.push(label);
  }

  // A product written several ways ("Proan K Rapid", "Proan k rapid") takes its most frequent spelling.
  parsed.sort((a, b) => (timesWritten.get(b.label) ?? 0) - (timesWritten.get(a.label) ?? 0));
  const existing = await deps.products.findByKeys([...new Set(parsed.map(({ product }) => product.key))]);
  const groups = new Map<string, ProductGroup>();
  for (const { label, product } of parsed) {
    const match = existing.get(product.key);
    const group = groups.get(product.key) ?? {
      key: product.key,
      name: match?.name ?? product.name,
      existingId: match?.id ?? null,
      presentations: [],
    };
    const content = Quantity.parse(product.content).toDecimalString();
    const presentation = group.presentations.find((p) => p.unit === product.unit && p.content === content);
    if (presentation) presentation.labels.push(label);
    else {
      const exists =
        match?.presentations.some((p) => p.unit === product.unit && p.content === content) ?? false;
      group.presentations.push({ content, unit: product.unit, exists, labels: [label] });
    }
    groups.set(product.key, group);
  }
  const products = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { products, unreadableProducts };
}
