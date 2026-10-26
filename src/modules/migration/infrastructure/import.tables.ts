import { date, index, integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "@/shared/infrastructure/db/columns";

/** One imported sheet. Re-importing the same sheet and campaign replaces it (D17). */
export const importBatches = pgTable(
  "import_batches",
  {
    id: id(),
    fileName: text().notNull(),
    sheetName: text().notNull(),
    /** Empty when the sheet has no "CAMPAÑA …" title, so the unique key still applies. */
    campaignLabel: text().notNull().default(""),
    importedBy: text().notNull(),
    importedAt: createdAt(),
  },
  (table) => [uniqueIndex("import_batches_sheet_campaign_key").on(table.sheetName, table.campaignLabel)],
);

const batchId = () =>
  uuid()
    .notNull()
    .references(() => importBatches.id, { onDelete: "cascade" });

export const importedSalesLines = pgTable(
  "imported_sales_lines",
  {
    id: id(),
    batchId: batchId(),
    rowNumber: integer().notNull(),
    kind: text({ enum: ["delivery", "return"] }).notNull(),
    saleDate: date({ mode: "string" }),
    product: text().notNull(),
    customerName: text().notNull(),
    customerKey: text().notNull(),
    quantity: numeric({ precision: 12, scale: 3 }).notNull(),
    unitPrice: numeric({ precision: 14, scale: 2 }).notNull(),
    total: numeric({ precision: 14, scale: 2 }).notNull(),
    exchangeRate: numeric({ precision: 10, scale: 4 }),
    observation: text(),
    noteNumber: integer(),
  },
  (table) => [index().on(table.batchId, table.customerKey)],
);

export const importedSummaryRows = pgTable(
  "imported_summary_rows",
  {
    id: id(),
    batchId: batchId(),
    rowNumber: integer().notNull(),
    customerName: text().notNull(),
    customerKey: text().notNull(),
    paid: numeric({ precision: 14, scale: 2 }).notNull(),
    returned: numeric({ precision: 14, scale: 2 }).notNull(),
  },
  (table) => [index().on(table.batchId, table.customerKey)],
);

export const importIssues = pgTable(
  "import_issues",
  {
    id: id(),
    batchId: batchId(),
    rowNumber: integer(),
    code: text().notNull(),
    details: jsonb().$type<Record<string, string>>().notNull(),
  },
  (table) => [index().on(table.batchId)],
);
