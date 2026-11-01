import { z } from "zod";
import type { ContentUnit } from "@/modules/catalog/domain/product";
import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { Quantity } from "@/shared/domain/quantity";
import { parseProductList, type ProductListRow, type SkippedProductListRow } from "../domain/product-list";
import type { GeneralPrices, ProductRegistry } from "./conversion-ports";
import { MAX_WORKBOOK_BYTES } from "./import-use-cases";
import type { WorkbookReader } from "./ports";

export type ProductListDeps = {
  workbooks: WorkbookReader;
  products: ProductRegistry;
  prices: GeneralPrices;
  audit: AuditTrail;
};

/**
 * What saving would do with a row. A conflict is left out: its code belongs to another
 * presentation, the product already has that container under another code, or the list repeats
 * the container.
 */
export type ProductListRowPlan =
  | { status: "new_product" | "new_presentation" }
  | { status: "existing"; productName: string; priceKept: boolean }
  | { status: "conflict"; reason: "code_taken"; productName: string; content: string; unit: ContentUnit }
  | { status: "conflict"; reason: "other_code"; code: string }
  | { status: "conflict"; reason: "repeated" };

export type ProductListPreview = {
  fileName: string;
  sheetName: string;
  rows: (ProductListRow & { plan: ProductListRowPlan })[];
  skipped: SkippedProductListRow[];
  counts: {
    newProducts: number;
    newPresentations: number;
    existing: number;
    conflicts: number;
    prices: number;
  };
};

const fileSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  content: z.instanceof(Uint8Array),
});

const importSchema = fileSchema.extend({ campaignId: z.uuid({ error: "Elige la campaña de los precios." }) });

/** Reads Agrosoy's product list and compares it with the catalog; nothing is written. */
export async function previewProductList(
  deps: Pick<ProductListDeps, "workbooks" | "products">,
  actor: Actor,
  input: unknown,
): Promise<ProductListPreview> {
  assertCan(actor, "catalog.manage");
  const { fileName, content } = validateInput(fileSchema, input);
  return plan(deps.products, fileName, await readList(deps.workbooks, fileName, content));
}

/**
 * Creates the list's new products and presentations with Agrosoy's codes, and makes its prices
 * the campaign's general reference prices (D23), which each zone can still override. Running it
 * again creates nothing new and only refreshes the prices.
 */
export async function importProductList(
  deps: ProductListDeps,
  actor: Actor,
  input: unknown,
): Promise<ProductListPreview["counts"]> {
  assertCan(actor, "catalog.manage");
  const { fileName, content, campaignId } = validateInput(importSchema, input);
  const preview = await plan(deps.products, fileName, await readList(deps.workbooks, fileName, content));

  const newProducts = new Map<string, (typeof preview.rows)[number][]>();
  for (const row of preview.rows) {
    if (row.plan.status === "new_product")
      newProducts.set(row.key, [...(newProducts.get(row.key) ?? []), row]);
  }
  for (const rows of newProducts.values()) {
    const [first] = rows;
    if (!first) continue;
    await deps.products.create({ name: first.name, line: first.line, presentations: rows.map(specOf) });
  }
  const existing = await deps.products.findByKeys([
    ...new Set(preview.rows.filter((row) => row.plan.status === "new_presentation").map((row) => row.key)),
  ]);
  for (const row of preview.rows) {
    if (row.plan.status !== "new_presentation") continue;
    const product = existing.get(row.key);
    if (product) await deps.products.addPresentation(product.id, specOf(row));
  }

  const priced = preview.rows.filter(importsPrice);
  const ids = await deps.products.findByCodes(priced.map((row) => row.code));
  await deps.prices.save(
    campaignId,
    priced.flatMap((row) => {
      const presentation = ids.get(row.code);
      return presentation && row.price ? [{ presentationId: presentation.id, price: row.price }] : [];
    }),
  );

  await deps.audit.record({
    actorId: actor.id,
    action: "migration.import_product_list",
    entityType: "campaign",
    entityId: campaignId,
    payload: { name: fileName, sheetName: preview.sheetName, ...preview.counts },
  });
  return preview.counts;
}

async function readList(workbooks: WorkbookReader, fileName: string, content: Uint8Array) {
  if (
    !fileName.toLowerCase().endsWith(".xlsx") ||
    content.byteLength === 0 ||
    content.byteLength > MAX_WORKBOOK_BYTES
  ) {
    throw new DomainError("INVALID_FILE", { fileName, bytes: content.byteLength });
  }
  for (const grid of await workbooks.read(content)) {
    const list = parseProductList(grid);
    if (list) return list;
  }
  throw new DomainError("INVALID_FILE", { fileName, reason: "no_product_list" });
}

async function plan(
  products: ProductRegistry,
  fileName: string,
  list: NonNullable<ReturnType<typeof parseProductList>>,
): Promise<ProductListPreview> {
  const [byCode, byKey] = await Promise.all([
    products.findByCodes(list.rows.map((row) => row.code)),
    products.findByKeys([...new Set(list.rows.map((row) => row.key))]),
  ]);
  const containers = new Set<string>();
  const rows = list.rows.map((row) => {
    const content = Quantity.parse(row.content).toDecimalString();
    const container = `${row.key}|${content}|${row.unit}`;
    const repeated = containers.has(container);
    containers.add(container);

    const taken = byCode.get(row.code);
    const product = byKey.get(row.key);
    const sameContainer = product?.presentations.find(
      (presentation) => presentation.content === content && presentation.unit === row.unit,
    );
    let rowPlan: ProductListRowPlan;
    if (taken && taken.productKey === row.key && taken.content === content && taken.unit === row.unit) {
      // A presentation charged another way keeps its price: the list's would mean something else.
      rowPlan = {
        status: "existing",
        productName: taken.productName,
        priceKept: taken.saleUnit !== row.saleUnit,
      };
    } else if (taken) {
      rowPlan = {
        status: "conflict",
        reason: "code_taken",
        productName: taken.productName,
        content: taken.content,
        unit: taken.unit,
      };
    } else if (sameContainer) {
      rowPlan = { status: "conflict", reason: "other_code", code: sameContainer.code };
    } else if (repeated) {
      rowPlan = { status: "conflict", reason: "repeated" };
    } else {
      rowPlan = { status: product ? "new_presentation" : "new_product" };
    }
    return { ...row, plan: rowPlan };
  });

  const count = (status: ProductListRowPlan["status"]) =>
    rows.filter((row) => row.plan.status === status).length;
  return {
    fileName,
    sheetName: list.sheetName,
    rows,
    skipped: list.skipped,
    counts: {
      newProducts: new Set(rows.filter((row) => row.plan.status === "new_product").map((row) => row.key))
        .size,
      newPresentations: count("new_presentation") + count("new_product"),
      existing: count("existing"),
      conflicts: count("conflict"),
      prices: rows.filter(importsPrice).length,
    },
  };
}

function importsPrice(row: ProductListPreview["rows"][number]): boolean {
  if (row.price === null || row.plan.status === "conflict") return false;
  return row.plan.status !== "existing" || !row.plan.priceKept;
}

function specOf(row: ProductListRow) {
  return { code: row.code, content: row.content, unit: row.unit, saleUnit: row.saleUnit };
}
