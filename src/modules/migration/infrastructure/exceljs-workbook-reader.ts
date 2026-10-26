import ExcelJS from "exceljs";
import { DomainError } from "@/shared/domain/domain-error";
import type { WorkbookReader } from "../application/ports";
import type { CellValue, SheetGrid } from "../domain/sales-sheet";

/** Reads .xlsx files with exceljs into plain grids: formulas replaced by their cached result. */
export const exceljsWorkbookReader: WorkbookReader = {
  async read(content) {
    const workbook = new ExcelJS.Workbook();
    try {
      // exceljs's Buffer typing predates Node's generic Buffer; the bytes are what it needs.
      await workbook.xlsx.load(Buffer.from(content) as unknown as ExcelJS.Buffer);
    } catch {
      throw new DomainError("INVALID_FILE");
    }
    return workbook.worksheets.map(toGrid);
  },
};

function toGrid(sheet: ExcelJS.Worksheet): SheetGrid {
  const rows: CellValue[][] = [];
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const cells: CellValue[] = [];
    for (let column = 1; column <= sheet.columnCount; column++) {
      cells.push(cellValue(row.getCell(column)));
    }
    rows.push(cells);
  }
  return { name: sheet.name, rows };
}

function cellValue(cell: ExcelJS.Cell): CellValue {
  // A merged range repeats its value in every cell; only the top-left one holds it.
  if (cell.isMerged && cell.master.address !== cell.address) return null;
  return plain(cell.value);
}

function plain(value: ExcelJS.CellValue): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || value instanceof Date) return value;
  if (typeof value === "boolean") return null;
  if ("result" in value) return plain(value.result as ExcelJS.CellValue);
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("text" in value && typeof value.text === "string") return value.text;
  // Formulas saved without a cached result, errors and other objects carry no usable value.
  return null;
}
