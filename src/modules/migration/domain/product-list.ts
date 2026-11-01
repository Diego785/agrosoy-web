import {
  measureOf,
  presentationCode,
  type ContentUnit,
  type ProductLine,
  type SaleUnit,
} from "@/modules/catalog/domain/product";
import { cleanText, normalizeForComparison } from "@/shared/domain/text";
import { parseProductLabel } from "./product-label";
import type { CellValue, SheetGrid } from "./sales-sheet";
import { spreadsheetNumberToDecimal } from "./spreadsheet-number";

/**
 * What a row of the product list needs reviewed. The row is still imported, as described:
 * - NO_CONTAINER: no container in brackets, created as 1 unit priced per container (D23).
 * - NO_PRICE_UNIT / UNKNOWN_PRICE_UNIT: charged per container.
 * - PRICE_UNIT_MISMATCH: "per kilo" next to a liquid (or the other way); charged per the
 *   container's own measure.
 * - NO_PRICE: no reference price; it can be set later on the price sheet.
 */
export const PRODUCT_LIST_FINDINGS = [
  "NO_CONTAINER",
  "NO_PRICE_UNIT",
  "UNKNOWN_PRICE_UNIT",
  "PRICE_UNIT_MISMATCH",
  "NO_PRICE",
] as const;
export type ProductListFinding = (typeof PRODUCT_LIST_FINDINGS)[number];

export type ProductListRow = {
  /** 1-based, as in Excel. */
  row: number;
  code: string;
  /** As written: "Fulvin 40-22(20lts.)" */
  label: string;
  name: string;
  /** Comparison key of the name, which groups a product's presentations. */
  key: string;
  /** Decimal string, "20" */
  content: string;
  unit: ContentUnit;
  saleUnit: SaleUnit;
  /** US$ per sale unit, "7.80", or null without a price. */
  price: string | null;
  /** As written in the sheet ("Litro"), shown next to the findings. */
  priceUnit: string | null;
  line: ProductLine;
  findings: ProductListFinding[];
};

/** Rows that are not imported: the "OTROS" concepts (week 3, D24) and unreadable codes. */
export type SkippedProductListRow = {
  row: number;
  code: string | null;
  label: string;
  reason: "CHARGE_CONCEPT" | "INVALID_CODE" | "REPEATED_CODE";
};

export type ParsedProductList = {
  sheetName: string;
  rows: ProductListRow[];
  skipped: SkippedProductListRow[];
};

type Columns = { code: number; product: number; price: number | undefined };

/**
 * Reads Agrosoil's product list ("CODIGOS DE LOS PRODUCTOS"): code, name with the container in
 * brackets, US$ price and, in the column after it, what the price is per. Rows under the
 * "AGROQUIMICOS" heading are agrochemicals, the ones before it fertilizers, and the "OTROS" ones
 * are charge concepts. Returns undefined when the sheet has no such table.
 */
export function parseProductList(grid: SheetGrid): ParsedProductList | undefined {
  const header = findHeader(grid);
  if (!header) return undefined;
  const { columns } = header;

  const rows: ProductListRow[] = [];
  const skipped: SkippedProductListRow[] = [];
  const seenCodes = new Set<string>();
  let section: "fertilizers" | "agrochemicals" | "charges" = "fertilizers";

  for (let index = header.row + 1; index < grid.rows.length; index++) {
    const cells = grid.rows[index] ?? [];
    const rawCode = cells[columns.code] ?? null;
    const label = textOf(cells[columns.product] ?? null);
    const heading = typeof rawCode === "string" && !/\d/.test(rawCode) ? keyOf(rawCode) : "";

    if (heading && !label) {
      if (heading.startsWith("agroquimico")) section = "agrochemicals";
      else if (heading.startsWith("fertilizante")) section = "fertilizers";
      else if (heading.startsWith("otro")) section = "charges";
      continue;
    }
    if (!label) continue;

    const row = index + 1;
    const code = codeFrom(rawCode);
    if (section === "charges") {
      skipped.push({ row, code: code ?? null, label, reason: "CHARGE_CONCEPT" });
      continue;
    }
    if (!code) {
      skipped.push({ row, code: textOf(rawCode), label, reason: "INVALID_CODE" });
      continue;
    }
    if (seenCodes.has(code)) {
      skipped.push({ row, code, label, reason: "REPEATED_CODE" });
      continue;
    }
    seenCodes.add(code);

    const priceUnit = columns.price === undefined ? null : textOf(cells[columns.price + 1] ?? null);
    const price = columns.price === undefined ? null : priceFrom(cells[columns.price] ?? null);
    const presentation = presentationFrom(label, priceUnit);
    rows.push({
      row,
      code,
      label,
      line: section,
      priceUnit,
      ...presentation,
      price,
      findings: price === null ? [...presentation.findings, "NO_PRICE"] : presentation.findings,
    });
  }
  return { sheetName: grid.name, rows: withCommonNames(rows), skipped };
}

function findHeader(grid: SheetGrid): { row: number; columns: Columns } | undefined {
  for (let row = 0; row < grid.rows.length; row++) {
    const keys = (grid.rows[row] ?? []).map(keyOf);
    const code = keys.findIndex((key) => key.startsWith("codigo"));
    const product = keys.findIndex((key) => key.startsWith("producto"));
    if (code === -1 || product === -1) continue;
    const price = keys.findIndex((key) => key.startsWith("precio"));
    return { row, columns: { code, product, price: price === -1 ? undefined : price } };
  }
  return undefined;
}

const PER_MEASURE: Record<string, "l" | "kg"> = {
  l: "l",
  lt: "l",
  lts: "l",
  litro: "l",
  litros: "l",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
};

const PER_CONTAINER = new Set([
  "frasco",
  "frascos",
  "bolsa",
  "bolsas",
  "sobre",
  "sobres",
  "envase",
  "envases",
  "bidon",
  "bidones",
  "balde",
  "baldes",
  "caja",
  "cajas",
  "unidad",
  "unidades",
]);

function presentationFrom(
  label: string,
  priceUnit: string | null,
): Pick<ProductListRow, "name" | "key" | "content" | "unit" | "saleUnit" | "findings"> {
  const findings: ProductListFinding[] = [];
  const parsed = parseProductLabel(label);
  const name = parsed?.name ?? cleanText(label);
  const content = parsed?.content ?? "1";
  const unit: ContentUnit = parsed?.unit ?? "u";
  if (!parsed) findings.push("NO_CONTAINER");

  const per = priceUnit ? keyOf(priceUnit) : "";
  let saleUnit: SaleUnit = "container";
  if (!per) {
    if (parsed) findings.push("NO_PRICE_UNIT");
  } else if (PER_MEASURE[per]) {
    // Pieces have no liter or kilo to charge by.
    if (unit === "u") findings.push("PRICE_UNIT_MISMATCH");
    else {
      saleUnit = "measure";
      if (PER_MEASURE[per] !== measureOf(unit)) findings.push("PRICE_UNIT_MISMATCH");
    }
  } else if (!PER_CONTAINER.has(per)) {
    findings.push("UNKNOWN_PRICE_UNIT");
  }
  return { name, key: normalizeForComparison(name), content, unit, saleUnit, findings };
}

/** "7.80", or null when the cell is empty, zero or not a price. */
function priceFrom(cell: CellValue): string | null {
  const value =
    typeof cell === "number"
      ? spreadsheetNumberToDecimal(cell, 2)?.value
      : typeof cell === "string" && /^\s*\d+([.,]\d{1,2})?\s*$/.test(cell)
        ? cell.trim().replace(",", ".")
        : undefined;
  if (!value || Number(value) <= 0) return null;
  const [whole = "0", fraction = ""] = value.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

/**
 * The same product is written several ways ("A-Micsur Zn", "A-MICSUR ZN"); all its rows take
 * the first spelling that isn't all capitals, or the first one when every spelling is.
 */
function withCommonNames(rows: ProductListRow[]): ProductListRow[] {
  const names = new Map<string, string>();
  for (const row of rows) {
    const current = names.get(row.key);
    if (!current || (current === current.toUpperCase() && row.name !== row.name.toUpperCase())) {
      names.set(row.key, row.name);
    }
  }
  return rows.map((row) => ({ ...row, name: names.get(row.key) ?? row.name }));
}

function codeFrom(cell: CellValue): string | undefined {
  if (typeof cell === "number" && Number.isInteger(cell) && cell > 0) return presentationCode(String(cell));
  return typeof cell === "string" ? presentationCode(cell) : undefined;
}

function keyOf(cell: CellValue): string {
  return typeof cell === "string"
    ? normalizeForComparison(cell)
        .replace(/[^a-z0-9ñ ]/g, "")
        .trim()
    : "";
}

function textOf(cell: CellValue): string | null {
  if (typeof cell === "number") return String(cell);
  if (typeof cell !== "string") return null;
  const text = cleanText(cell);
  return text === "" ? null : text;
}
