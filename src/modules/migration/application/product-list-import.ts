import { z } from "zod";
import type { ContentUnit } from "@/modules/catalog/domain/product";
import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";
import { parseProductList, type ProductListRow, type SkippedProductListRow } from "../domain/product-list";
import type { ExistingProduct, GeneralPrices, ProductRegistry } from "./conversion-ports";
import { MAX_WORKBOOK_BYTES } from "./import-use-cases";
import type { WorkbookReader } from "./ports";

export type ProductListDeps = {
  workbooks: WorkbookReader;
  products: ProductRegistry;
  prices: GeneralPrices;
  audit: AuditTrail;
};

/**
 * What saving would do with a row. The code identifies a presentation (D23): a row with a code in
 * use and the same container updates that presentation's price, and its product's name. A conflict
 * is left out: its code belongs to another container, the product already has that container under
 * another code, or the list repeats the container.
 */
export type ProductListRowPlan =
  | { status: "new_product" | "new_presentation" }
  | {
      status: "existing";
      productName: string;
      /** Charged another way in the system: the list's price would mean something else. */
      priceKept: boolean;
      /** The campaign's general price before this list ("7.80", or null without one), when it changes. */
      priceChange: { from: string | null } | null;
      /** The product takes the name the list gives it. */
      renamedFrom: string | null;
      /**
       * The list's name is not applied: other presentations of the product carry another name in the
       * list, or another product already has that name.
       */
      nameKept: "other_names" | "name_taken" | null;
    }
  | { status: "conflict"; reason: "code_taken"; productName: string; content: string; unit: ContentUnit }
  | { status: "conflict"; reason: "other_code"; code: string; productName: string }
  | { status: "conflict"; reason: "repeated" };

export type ProductListPreview = {
  fileName: string;
  sheetName: string;
  /** The campaign whose general prices the list was compared with, if one was chosen. */
  campaignId: string | null;
  rows: (ProductListRow & { plan: ProductListRowPlan })[];
  skipped: SkippedProductListRow[];
  counts: {
    newProducts: number;
    newPresentations: number;
    existing: number;
    conflicts: number;
    prices: number;
    priceChanges: number;
    renamed: number;
  };
};

const fileSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  content: z.instanceof(Uint8Array),
});

const previewSchema = fileSchema.extend({ campaignId: z.uuid().optional().catch(undefined) });

const importSchema = fileSchema.extend({ campaignId: z.uuid({ error: "Elige la campaña de los precios." }) });

/**
 * Reads Agrosoil's product list and compares it with the catalog and, when a campaign is given,
 * with that campaign's general prices; nothing is written.
 */
export async function previewProductList(
  deps: Pick<ProductListDeps, "workbooks" | "products" | "prices">,
  actor: Actor,
  input: unknown,
): Promise<ProductListPreview> {
  assertCan(actor, "catalog.manage");
  const { fileName, content, campaignId } = validateInput(previewSchema, input);
  return plan(deps, fileName, await readList(deps.workbooks, fileName, content), campaignId ?? null);
}

/**
 * Creates the list's new products and presentations with Agrosoil's codes, renames products the
 * list names differently, and makes its prices the campaign's general reference prices (D23),
 * which each zone can still override. Running it again creates nothing new: it only applies what
 * changed in the list.
 */
export async function importProductList(
  deps: ProductListDeps,
  actor: Actor,
  input: unknown,
): Promise<ProductListPreview["counts"]> {
  assertCan(actor, "catalog.manage");
  const { fileName, content, campaignId } = validateInput(importSchema, input);
  const preview = await plan(deps, fileName, await readList(deps.workbooks, fileName, content), campaignId);

  // Renames first: new presentations listed under the new name then join the renamed product.
  const renaming = preview.rows.filter((row) => row.plan.status === "existing" && row.plan.renamedFrom);
  const renamingCodes = await deps.products.findByCodes(renaming.map((row) => row.code));
  const renamed = new Set<string>();
  for (const row of renaming) {
    const presentation = renamingCodes.get(row.code);
    if (!presentation || renamed.has(presentation.productId)) continue;
    renamed.add(presentation.productId);
    await deps.products.rename(presentation.productId, row.name);
  }

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

type Rename = { productId: string; fromKey: string; fromName: string };

async function plan(
  deps: Pick<ProductListDeps, "products" | "prices">,
  fileName: string,
  list: NonNullable<ReturnType<typeof parseProductList>>,
  campaignId: string | null,
): Promise<ProductListPreview> {
  const [byCode, byKey, current] = await Promise.all([
    deps.products.findByCodes(list.rows.map((row) => row.code)),
    deps.products.findByKeys([...new Set(list.rows.map((row) => row.key))]),
    campaignId ? deps.prices.current(campaignId) : Promise.resolve(new Map<string, string>()),
  ]);
  const contentOf = (row: ProductListRow) => Quantity.parse(row.content).toDecimalString();
  const takenBy = (row: ProductListRow) => {
    const taken = byCode.get(row.code);
    return taken && taken.content === contentOf(row) && taken.unit === row.unit ? taken : undefined;
  };

  // A product takes the list's name only when all its rows in the list carry that one name.
  const listNames = new Map<string, Set<string>>();
  for (const row of list.rows) {
    const taken = takenBy(row);
    if (taken) listNames.set(taken.productId, (listNames.get(taken.productId) ?? new Set()).add(row.key));
  }
  const renames = new Map<string, Rename>();
  const nameTaken = new Set<string>();
  for (const row of list.rows) {
    const taken = takenBy(row);
    if (!taken || taken.productKey === row.key || listNames.get(taken.productId)?.size !== 1) continue;
    const owner = byKey.get(row.key);
    if (owner && owner.id !== taken.productId) nameTaken.add(taken.productId);
    else
      renames.set(row.key, {
        productId: taken.productId,
        fromKey: taken.productKey,
        fromName: taken.productName,
      });
  }
  // Products about to be renamed, under their new name, for the new containers listed with it.
  const renamedProducts = new Map<string, ExistingProduct>();
  if (renames.size > 0) {
    const before = await deps.products.findByKeys([...renames.values()].map((rename) => rename.fromKey));
    for (const [key, rename] of renames) {
      const product = before.get(rename.fromKey);
      if (product) renamedProducts.set(key, product);
    }
  }

  const containers = new Set<string>();
  const rows = list.rows.map((row) => {
    const content = contentOf(row);
    const container = `${row.key}|${content}|${row.unit}`;
    const repeated = containers.has(container);
    containers.add(container);

    const taken = byCode.get(row.code);
    const product = byKey.get(row.key) ?? renamedProducts.get(row.key);
    const sameContainer = product?.presentations.find(
      (presentation) => presentation.content === content && presentation.unit === row.unit,
    );
    let rowPlan: ProductListRowPlan;
    if (taken && takenBy(row)) {
      const priceKept = taken.saleUnit !== row.saleUnit;
      const before = current.get(taken.id) ?? null;
      const changesPrice =
        campaignId !== null && !priceKept && row.price !== null && !samePrice(before, row.price);
      const rename = taken.productKey !== row.key && renames.get(row.key)?.productId === taken.productId;
      rowPlan = {
        status: "existing",
        productName: taken.productName,
        priceKept,
        priceChange: changesPrice ? { from: before } : null,
        renamedFrom: rename ? taken.productName : null,
        nameKept:
          taken.productKey === row.key || rename
            ? null
            : nameTaken.has(taken.productId)
              ? "name_taken"
              : "other_names",
      };
    } else if (taken) {
      rowPlan = {
        status: "conflict",
        reason: "code_taken",
        productName: taken.productName,
        content: taken.content,
        unit: taken.unit,
      };
    } else if (sameContainer && product) {
      rowPlan = {
        status: "conflict",
        reason: "other_code",
        code: sameContainer.code,
        productName: product.name,
      };
    } else if (repeated) {
      rowPlan = { status: "conflict", reason: "repeated" };
    } else {
      rowPlan = { status: product ? "new_presentation" : "new_product" };
    }
    return { ...row, plan: rowPlan };
  });

  const count = (status: ProductListRowPlan["status"]) =>
    rows.filter((row) => row.plan.status === status).length;
  const existingPlans = rows.flatMap((row) => (row.plan.status === "existing" ? [row.plan] : []));
  return {
    fileName,
    sheetName: list.sheetName,
    campaignId,
    rows,
    skipped: list.skipped,
    counts: {
      newProducts: new Set(rows.filter((row) => row.plan.status === "new_product").map((row) => row.key))
        .size,
      newPresentations: count("new_presentation") + count("new_product"),
      existing: count("existing"),
      conflicts: count("conflict"),
      prices: rows.filter(importsPrice).length,
      priceChanges: existingPlans.filter((rowPlan) => rowPlan.priceChange).length,
      renamed: renames.size,
    },
  };
}

function samePrice(stored: string | null, listed: string): boolean {
  return stored !== null && Money.parse(stored).equals(Money.parse(listed));
}

function importsPrice(row: ProductListPreview["rows"][number]): boolean {
  if (row.price === null || row.plan.status === "conflict") return false;
  return row.plan.status !== "existing" || !row.plan.priceKept;
}

function specOf(row: ProductListRow) {
  return { code: row.code, content: row.content, unit: row.unit, saleUnit: row.saleUnit };
}
