import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";
import { UnitPrice } from "@/shared/domain/unit-price";
import { cleanText, normalizeForComparison } from "@/shared/domain/text";
import { spreadsheetNumberToDecimal } from "./spreadsheet-number";

/** A cell as the workbook reader hands it over: formulas already replaced by their value. */
export type CellValue = string | number | Date | null;

export type SheetGrid = { name: string; rows: readonly (readonly CellValue[])[] };

export const IMPORT_ISSUE_CODES = [
  "HEADER_NOT_FOUND",
  "MISSING_COLUMN",
  "INVALID_VALUE",
  "INVALID_DATE",
  "ROUNDED_VALUE",
  "MISSING_EXCHANGE_RATE",
  "ZERO_PRICE",
  "LINE_TOTAL_MISMATCH",
  "SHEET_TOTAL_MISMATCH",
  "NOTE_NUMBER_REUSED",
  "CUSTOMER_NOT_IN_SUMMARY",
  "SUMMARY_CUSTOMER_UNMATCHED",
  "SUMMARY_DELIVERED_MISMATCH",
] as const;

export type ImportIssueCode = (typeof IMPORT_ISSUE_CODES)[number];

/** Something administration should review before the data is trusted. `row` is 1-based, as in Excel. */
export type ImportIssue = { row: number | null; code: ImportIssueCode; details: Record<string, string> };

export type SalesLine = {
  row: number;
  kind: "delivery" | "return";
  /** ISO date, or null when the cell was empty or unreadable. */
  date: string | null;
  product: string;
  customerName: string;
  customerKey: string;
  quantity: Quantity;
  /** Up to 4 decimals, as the sheet keeps it (D60). */
  unitPrice: UnitPrice;
  /** The sheet's own line total when it has one, so a note adds up to what Excel shows (D60); otherwise quantity × price. */
  total: Money;
  exchangeRate: ExchangeRate | null;
  observation: string | null;
  noteNumber: number | null;
};

/** One row of the per-customer summary next to the sales table (Entrega / Pago / Dev. / Deuda). */
export type SummaryRow = {
  row: number;
  customerName: string;
  customerKey: string;
  paid: Money;
  returned: Money;
};

export type ParsedSalesSheet = {
  sheetName: string;
  campaignLabel: string | null;
  lines: SalesLine[];
  summary: SummaryRow[];
  issues: ImportIssue[];
};

type Column =
  "date" | "product" | "customer" | "quantity" | "price" | "total" | "rate" | "observation" | "note";
type ColumnMap = Partial<Record<Column, number>>;

/**
 * Reads one technician's sales sheet: the sales table, the returns table ("DEVOLUCIONES") and the
 * per-customer summary. Tables are found by their header text, not by fixed positions, so sheets
 * of other technicians with shifted columns read the same way.
 */
export function parseSalesSheet(grid: SheetGrid): ParsedSalesSheet {
  const issues: ImportIssue[] = [];
  const headers = findLineHeaders(grid);
  if (headers.length === 0) {
    issues.push({ row: null, code: "HEADER_NOT_FOUND", details: { sheet: grid.name } });
    return { sheetName: grid.name, campaignLabel: null, lines: [], summary: [], issues };
  }

  const lines: SalesLine[] = [];
  let declaredTotal: Money | undefined;
  for (const header of headers) {
    reportMissingColumns(header, issues);
    const section = readSection(grid, header, issues);
    lines.push(...section.lines);
    if (header.kind === "delivery") declaredTotal ??= section.declaredTotal;
  }

  checkSheetTotal(lines, declaredTotal, issues);
  checkNoteNumbers(lines, issues);
  const summary = readSummary(grid, lines, issues);

  return {
    sheetName: grid.name,
    campaignLabel: findCampaignLabel(grid, headers[0]?.row ?? 0),
    lines,
    summary,
    issues,
  };
}

// ---------------------------------------------------------------------------------------------
// Tables

type LineHeader = { row: number; kind: SalesLine["kind"]; columns: ColumnMap };

function findLineHeaders(grid: SheetGrid): LineHeader[] {
  const headers: LineHeader[] = [];
  grid.rows.forEach((cells, index) => {
    const columns = lineColumns(cells);
    if (!isLineHeader(columns)) return;
    const recent = grid.rows.slice(Math.max(0, index - 2), index).flat();
    const kind = recent.some((cell) => keyOf(cell).startsWith("devolucion")) ? "return" : "delivery";
    headers.push({ row: index, kind, columns });
  });
  return headers;
}

/** A table starts where a row names the date, product and customer columns. */
function isLineHeader(columns: ColumnMap): boolean {
  return columns.date !== undefined && columns.product !== undefined && columns.customer !== undefined;
}

/**
 * Header texts as technicians write them ("FECHA DE VENTA", "Productos", "CANT.", "T/C", "Nº BOLETA"),
 * compared after `keyOf` drops accents and punctuation (D43).
 */
function columnOf(key: string): Column | undefined {
  if (key.startsWith("fecha")) return "date";
  if (key.startsWith("producto")) return "product";
  if (key.startsWith("cliente")) return "customer";
  if (key.startsWith("cant")) return "quantity";
  if (key.startsWith("prec") || key === "pu" || key === "p u") return "price";
  if (key.startsWith("total")) return "total";
  if (
    key === "tc" ||
    key === "t c" ||
    key.startsWith("tc ") ||
    key.startsWith("tipo de cambio") ||
    key.startsWith("tipo cambio")
  ) {
    return "rate";
  }
  if (key.startsWith("observ") || key === "obs") return "observation";
  if (key.includes("boleta")) return "note";
  return undefined;
}

function lineColumns(cells: readonly CellValue[]): ColumnMap {
  const columns: ColumnMap = {};
  cells.forEach((cell, index) => {
    const column = columnOf(keyOf(cell));
    if (column && columns[column] === undefined) columns[column] = index;
  });
  return columns;
}

/**
 * Without quantity or price no row can be read; without a rate or note column the sales still come
 * in, with the rate left for the payment (D35) and one note per customer and date. Each missing column
 * is reported once, at the table's header row.
 */
function reportMissingColumns(header: LineHeader, issues: ImportIssue[]) {
  const expected: Column[] =
    header.kind === "delivery" ? ["quantity", "price", "rate", "note"] : ["quantity", "price"];
  for (const column of expected) {
    if (header.columns[column] === undefined) {
      issues.push({ row: header.row + 1, code: "MISSING_COLUMN", details: { column } });
    }
  }
}

function readSection(grid: SheetGrid, header: LineHeader, issues: ImportIssue[]) {
  const lines: SalesLine[] = [];
  let declaredTotal: Money | undefined;
  const { columns } = header;

  for (let index = header.row + 1; index < grid.rows.length; index++) {
    const cells = grid.rows[index] ?? [];
    const at = (column: Column) => (columns[column] === undefined ? null : (cells[columns[column]] ?? null));
    const row = index + 1;

    const firstKey = keyOf(at("date"));
    // The "Total" label usually sits in the date column, sometimes in the product one.
    const isTotalRow =
      firstKey.startsWith("total") || (keyOf(at("product")).startsWith("total") && !textOf(at("customer")));
    if (isTotalRow) {
      declaredTotal = moneyFrom(at("total"));
      break;
    }
    // Another table starts (returns, or the summary's "Cliente" header); a customer whose name merely
    // starts with "Cliente" doesn't end this one.
    const isOtherHeader =
      isLineHeader(lineColumns(cells)) || cells.some((cell) => ["cliente", "clientes"].includes(keyOf(cell)));
    if (firstKey.startsWith("devolucion") || isOtherHeader) break;

    const product = textOf(at("product"));
    const customerName = textOf(at("customer"));
    if (!product && !customerName) continue;

    const quantity = decimalFrom(at("quantity"), 3, row, "quantity", issues);
    const sheetTotal = moneyFrom(at("total"));
    // With the sheet's own total, a price beyond 4 decimals changes nothing owed: no need to report it.
    const price = decimalFrom(at("price"), 4, row, "price", sheetTotal ? [] : issues);
    if (!product || !customerName || quantity === undefined || price === undefined) {
      issues.push({
        row,
        code: "INVALID_VALUE",
        details: {
          field: !product
            ? "product"
            : !customerName
              ? "customer"
              : quantity === undefined
                ? "quantity"
                : "price",
        },
      });
      continue;
    }

    const line: SalesLine = {
      row,
      kind: header.kind,
      date: dateFrom(at("date"), row, issues),
      product,
      customerName,
      customerKey: normalizeForComparison(customerName),
      quantity: Quantity.parse(quantity),
      unitPrice: UnitPrice.parse(price),
      total: sheetTotal ?? Quantity.parse(quantity).times(UnitPrice.parse(price)),
      // A table without a rate column is reported once, not on every row.
      exchangeRate: rateFrom(
        at("rate"),
        row,
        header.kind === "delivery" && columns.rate !== undefined,
        issues,
      ),
      observation: textOf(at("observation")),
      noteNumber: noteFrom(at("note")),
    };
    if (line.unitPrice.isZero())
      issues.push({ row, code: "ZERO_PRICE", details: { observation: line.observation ?? "" } });
    // A cent apart is Excel's longer price; more than that is a total typed by hand, worth a look.
    const computed = line.quantity.times(line.unitPrice);
    const apart = line.total.subtract(computed);
    if (sheetTotal && (apart.compare(CENT) > 0 || apart.compare(CENT.negate()) < 0)) {
      issues.push({
        row,
        code: "LINE_TOTAL_MISMATCH",
        details: { sheet: sheetTotal.toDecimalString(), computed: computed.toDecimalString() },
      });
    }
    lines.push(line);
  }
  return { lines, declaredTotal };
}

function readSummary(grid: SheetGrid, lines: SalesLine[], issues: ImportIssue[]): SummaryRow[] {
  const headerIndex = grid.rows.findIndex((cells) => {
    const keys = cells.map(keyOf);
    return keys.includes("cliente") && keys.includes("entrega") && keys.includes("pago");
  });
  if (headerIndex === -1) return [];

  const keys = (grid.rows[headerIndex] ?? []).map(keyOf);
  const column = (name: string) => keys.findIndex((key) => key.startsWith(name));
  const [customerColumn, deliveredColumn, paidColumn, returnedColumn] = [
    column("cliente"),
    column("entrega"),
    column("pago"),
    column("dev"),
  ];

  const deliveredByCustomer = totalsByCustomer(lines.filter((line) => line.kind === "delivery"));
  const lineCustomers = [...new Map(lines.map((line) => [line.customerKey, line.customerName])).entries()];
  const summary: SummaryRow[] = [];

  for (let index = headerIndex + 1; index < grid.rows.length; index++) {
    const cells = grid.rows[index] ?? [];
    const name = textOf(cells[customerColumn] ?? null);
    if (!name || keyOf(name).startsWith("deuda total") || keyOf(name).startsWith("total")) break;
    const row = index + 1;

    const match = matchCustomer(normalizeForComparison(name), lineCustomers);
    if (!match) issues.push({ row, code: "SUMMARY_CUSTOMER_UNMATCHED", details: { customer: name } });
    const customerKey = match?.[0] ?? normalizeForComparison(name);

    const declaredDelivered = moneyFrom(cells[deliveredColumn] ?? null);
    const computedDelivered = deliveredByCustomer.get(customerKey) ?? Money.zero();
    if (match && declaredDelivered && !declaredDelivered.equals(computedDelivered)) {
      issues.push({
        row,
        code: "SUMMARY_DELIVERED_MISMATCH",
        details: {
          customer: match[1],
          sheet: declaredDelivered.toDecimalString(),
          computed: computedDelivered.toDecimalString(),
        },
      });
    }

    summary.push({
      row,
      customerName: match?.[1] ?? cleanText(name),
      customerKey,
      paid: moneyFrom(cells[paidColumn] ?? null) ?? Money.zero(),
      returned:
        returnedColumn === -1 ? Money.zero() : (moneyFrom(cells[returnedColumn] ?? null) ?? Money.zero()),
    });
  }

  const inSummary = new Set(summary.map((row) => row.customerKey));
  for (const [key, name] of lineCustomers) {
    if (!inSummary.has(key))
      issues.push({ row: null, code: "CUSTOMER_NOT_IN_SUMMARY", details: { customer: name } });
  }
  return summary;
}

/** Summary names are often shortened ("ANDRES KAORU" for "Andres Kaoru Matsudo"). */
function matchCustomer(key: string, customers: [string, string][]): [string, string] | undefined {
  const exact = customers.find(([candidate]) => candidate === key);
  if (exact) return exact;
  const partial = customers.filter(
    ([candidate]) => candidate.startsWith(`${key} `) || key.startsWith(`${candidate} `),
  );
  return partial.length === 1 ? partial[0] : undefined;
}

function findCampaignLabel(grid: SheetGrid, beforeRow: number): string | null {
  for (const cells of grid.rows.slice(0, beforeRow)) {
    const label = cells.map(textOf).find((text) => text && /campa[ñn]a/.test(keyOf(text)));
    if (label) return label;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Checks across the whole sheet

function checkSheetTotal(lines: SalesLine[], declared: Money | undefined, issues: ImportIssue[]) {
  if (!declared) return;
  const computed = Money.sum(lines.filter((line) => line.kind === "delivery").map((line) => line.total));
  if (!computed.equals(declared)) {
    issues.push({
      row: null,
      code: "SHEET_TOTAL_MISMATCH",
      details: { sheet: declared.toDecimalString(), computed: computed.toDecimalString() },
    });
  }
}

/** The same note number on different dates or customers usually means a typo in the pad number. */
function checkNoteNumbers(lines: SalesLine[], issues: ImportIssue[]) {
  const byNote = new Map<number, SalesLine[]>();
  for (const line of lines) {
    if (line.noteNumber !== null) byNote.set(line.noteNumber, [...(byNote.get(line.noteNumber) ?? []), line]);
  }
  for (const [note, noteLines] of byNote) {
    const dates = new Set(noteLines.map((line) => line.date ?? ""));
    const customers = new Set(noteLines.map((line) => line.customerKey));
    if (dates.size > 1 || customers.size > 1) {
      issues.push({
        row: noteLines[0]?.row ?? null,
        code: "NOTE_NUMBER_REUSED",
        details: {
          note: String(note),
          dates: [...dates].join(", "),
          rows: noteLines.map((line) => line.row).join(", "),
        },
      });
    }
  }
}

function totalsByCustomer(lines: SalesLine[]): Map<string, Money> {
  const totals = new Map<string, Money>();
  for (const line of lines)
    totals.set(line.customerKey, (totals.get(line.customerKey) ?? Money.zero()).add(line.total));
  return totals;
}

// ---------------------------------------------------------------------------------------------
// Cells

function keyOf(cell: CellValue): string {
  return typeof cell === "string"
    ? normalizeForComparison(cell)
        .replace(/[^a-z0-9ñ# ]/g, "")
        .trim()
    : "";
}

function textOf(cell: CellValue): string | null {
  if (cell === null || cell instanceof Date) return null;
  const text = cleanText(String(cell));
  return text === "" ? null : text;
}

function decimalFrom(cell: CellValue, decimals: number, row: number, field: string, issues: ImportIssue[]) {
  const number =
    typeof cell === "number"
      ? cell
      : typeof cell === "string" && cell.trim() !== ""
        ? Number(cell.trim().replace(",", "."))
        : Number.NaN;
  const converted = spreadsheetNumberToDecimal(number, decimals);
  if (!converted) return undefined;
  if (converted.rounded)
    issues.push({
      row,
      code: "ROUNDED_VALUE",
      details: { field, value: String(number), rounded: converted.value },
    });
  return converted.value;
}

const CENT = Money.parse("0.01");

function moneyFrom(cell: CellValue): Money | undefined {
  if (typeof cell !== "number") return undefined;
  const converted = spreadsheetNumberToDecimal(cell, 2);
  return converted ? Money.parse(converted.value) : undefined;
}

function rateFrom(
  cell: CellValue,
  row: number,
  reportBlank: boolean,
  issues: ImportIssue[],
): ExchangeRate | null {
  const converted = typeof cell === "number" && cell > 0 ? spreadsheetNumberToDecimal(cell, 4) : undefined;
  if (converted) return ExchangeRate.parse(converted.value);
  if (reportBlank) issues.push({ row, code: "MISSING_EXCHANGE_RATE", details: {} });
  return null;
}

function dateFrom(cell: CellValue, row: number, issues: ImportIssue[]): string | null {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    // Spreadsheet dates have no time zone; readers hand them over as UTC midnight.
    return cell.toISOString().slice(0, 10);
  }
  const match = typeof cell === "string" ? /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(cell.trim()) : null;
  if (match) return `${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
  issues.push({ row, code: "INVALID_DATE", details: { value: cell === null ? "" : String(cell) } });
  return null;
}

function noteFrom(cell: CellValue): number | null {
  const number =
    typeof cell === "number" ? cell : typeof cell === "string" ? Number(cell.trim()) : Number.NaN;
  return Number.isInteger(number) && number > 0 ? number : null;
}
