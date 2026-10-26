import type { ImportIssue, ParsedSalesSheet, SheetGrid } from "../domain/sales-sheet";

export type ImportBatch = {
  id: string;
  fileName: string;
  sheetName: string;
  campaignLabel: string | null;
  importedAt: Date;
  lineCount: number;
  customerCount: number;
  issueCount: number;
};

/** A sales or return line as stored: decimal strings, ready for value objects or display. */
export type StoredLine = {
  row: number;
  kind: "delivery" | "return";
  date: string | null;
  product: string;
  customerName: string;
  customerKey: string;
  quantity: string;
  unitPrice: string;
  total: string;
  exchangeRate: string | null;
  observation: string | null;
  noteNumber: number | null;
};

export type StoredSummaryRow = {
  row: number;
  customerName: string;
  customerKey: string;
  paid: string;
  returned: string;
};

/**
 * Imported spreadsheet data, kept apart from the system's own records (D17). Importing a sheet
 * again replaces its previous batch, so administration can fix the spreadsheet and retry.
 */
export interface ImportRepository {
  replaceSheet(input: {
    fileName: string;
    importedBy: string;
    sheet: ParsedSalesSheet;
  }): Promise<{ batchId: string; replaced: boolean }>;
  listBatches(): Promise<ImportBatch[]>;
  findBatch(batchId: string): Promise<ImportBatch | undefined>;
  lines(batchId: string, customerKey?: string): Promise<StoredLine[]>;
  summary(batchId: string, customerKey?: string): Promise<StoredSummaryRow[]>;
  issues(batchId: string): Promise<ImportIssue[]>;
}

export interface WorkbookReader {
  /** Every sheet of an .xlsx file; throws DomainError "INVALID_FILE" when it can't be read. */
  read(content: Uint8Array): Promise<SheetGrid[]>;
}
