import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { testDb } from "@test/test-database";
import { auditLog } from "@/shared/infrastructure/audit/audit-log.table";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import type { Actor } from "@/shared/application/actor";
import { importIssues, importSalesWorkbook, listImportBatches } from "../application/import-use-cases";
import { customerStatementFromImport, portfolioStatementFromImport } from "../application/statement-preview";
import { drizzleImportRepository } from "./drizzle-import-repository";
import { exceljsWorkbookReader } from "./exceljs-workbook-reader";

const admin = actorWithRole("admin");
const technician = actorWithRole("sales_technician");

function deps() {
  return {
    imports: drizzleImportRepository(testDb),
    workbooks: exceljsWorkbookReader,
    audit: drizzleAuditTrail(testDb),
  };
}

function importWorkbook(content: Uint8Array, actor: Actor = admin, fileName = "ventas.xlsx") {
  return testDb.transaction((tx) =>
    importSalesWorkbook(
      {
        imports: drizzleImportRepository(tx),
        workbooks: exceljsWorkbookReader,
        audit: drizzleAuditTrail(tx),
      },
      actor,
      { fileName, content },
    ),
  );
}

/** A workbook laid out like the technicians' sheets: merged title, formulas, side summary. */
async function workbook({ extraRow = false } = {}): Promise<Uint8Array> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Ing. Favio Añez");
  sheet.getCell("B2").value = "CAMPAÑA INVIERNO 2026";
  sheet.mergeCells("B2:K2");
  // In exceljs `row.values[1]` is column A; the leading holes put the table in column B, as in the real sheet.
  sheet.getRow(4).values = [
    ,
    ,
    "FECHA ",
    "PRODUCTO ",
    "CLIENTE ",
    "CANT. ",
    "PREC.",
    "TOTAL $US. ",
    "TIPO DE CAMBIO ",
    "OBSERVACION ",
    "#BOLETA ",
  ];
  const rows: [
    Date,
    string,
    string,
    number | ExcelJS.CellFormulaValue,
    number | ExcelJS.CellFormulaValue,
    number | null,
    string | null,
    number,
  ][] = [
    [
      new Date(Date.UTC(2026, 3, 30)),
      "Fulvin 40-22(20lts.)",
      "Alexander Jimenez ",
      200,
      11,
      6.96,
      null,
      11737,
    ],
    [
      new Date(Date.UTC(2026, 6, 23)),
      "4-energy(250ml.)",
      "Andres Kaoru Matsudo ",
      12,
      { formula: "250/4", result: 62.5 },
      10.9,
      "contado ",
      12125,
    ],
    [
      new Date(Date.UTC(2026, 4, 29)),
      "Biogain Amino Como(1lt.)",
      "Rodolfo Romero ",
      { formula: "12+8", result: 20 },
      39,
      6.96,
      null,
      11599,
    ],
  ];
  if (extraRow)
    rows.push([
      new Date(Date.UTC(2026, 8, 29)),
      "Proan(5kg.)",
      "Eduardo Cuaquira ",
      60,
      20,
      null,
      null,
      12491,
    ]);
  rows.forEach((values, index) => {
    const rowNumber = 5 + index;
    sheet.getRow(rowNumber).values = [
      ,
      ,
      ...values.slice(0, 5),
      { formula: `E${rowNumber}*F${rowNumber}` },
      ...values.slice(5),
    ];
  });
  sheet.getCell("B12").value = "Total ";
  sheet.getCell("G12").value = { formula: "SUM(G5:G7)", result: 3730 };

  sheet.getRow(20).values = [, , , , , , , , , , , , "Cliente", "Entrega", "Pago", "Dev.", "Deuda"];
  sheet.getRow(21).values = [, , , , , , , , , , , , "ALEXANDER JIMENEZ ", 2200, null, null, 2200];
  sheet.getRow(22).values = [, , , , , , , , , , , , "ANDRES KAORU", 750, 750, null, 0];
  sheet.getRow(23).values = [, , , , , , , , , , , , "RODOLFO ROMERO ", 780, 100.5, null, 679.5];
  sheet.getRow(24).values = [, , , , , , , , , , , , "DEUDA TOTAL "];

  book.addWorksheet("Notas").getCell("A1").value = "Recordatorios";
  return new Uint8Array(await book.xlsx.writeBuffer());
}

describe("spreadsheet import", () => {
  it("imports the sales sheet, skips sheets without a sales table and records it", async () => {
    const result = await importWorkbook(await workbook());

    expect(result.skippedSheets).toEqual(["Notas"]);
    expect(result.sheets).toMatchObject([
      { sheetName: "Ing. Favio Añez", campaignLabel: "CAMPAÑA INVIERNO 2026", lineCount: 3, replaced: false },
    ]);
    const [batch] = await listImportBatches(deps(), admin);
    expect(batch).toMatchObject({ lineCount: 3, customerCount: 3, campaignLabel: "CAMPAÑA INVIERNO 2026" });
    expect(await testDb.$count(auditLog)).toBe(1);
  });

  it("builds the portfolio statement with the same columns as the sheet's summary", async () => {
    const { sheets } = await importWorkbook(await workbook());
    const statement = await portfolioStatementFromImport(deps(), technician, sheets[0]?.batchId);

    expect(statement.source).toEqual({
      label: "Ing. Favio Añez",
      campaignLabel: "CAMPAÑA INVIERNO 2026",
      isPreview: true,
    });
    expect(statement.customers).toEqual([
      {
        key: "alexander jimenez",
        name: "Alexander Jimenez",
        totals: { delivered: "2200.00", paid: "0.00", returned: "0.00", balance: "2200.00", status: "owing" },
      },
      {
        key: "andres kaoru matsudo",
        name: "Andres Kaoru Matsudo",
        totals: { delivered: "750.00", paid: "750.00", returned: "0.00", balance: "0.00", status: "settled" },
      },
      {
        key: "rodolfo romero",
        name: "Rodolfo Romero",
        totals: { delivered: "780.00", paid: "100.50", returned: "0.00", balance: "679.50", status: "owing" },
      },
    ]);
    expect(statement.totals.balance).toBe("2879.50");
    // 850.50 collected of 3730.00 sold = 22.8 %
    expect(statement.collectedPerMille).toBe(228);
  });

  it("shows a customer's dated lines and the undated payment from the summary", async () => {
    const { sheets } = await importWorkbook(await workbook());
    const statement = await customerStatementFromImport(deps(), admin, sheets[0]?.batchId, "rodolfo romero");

    expect(statement.lines).toEqual([
      expect.objectContaining({
        kind: "delivery",
        date: "2026-05-29",
        noteNumber: 11599,
        quantity: "20.000",
        unitPrice: "39.00",
        amount: "780.00",
        exchangeRate: "6.9600",
      }),
      expect.objectContaining({ kind: "payment", date: null, amount: "100.50" }),
    ]);
    expect(statement.totals.status).toBe("owing");
  });

  it("replaces a sheet imported again and keeps its review list", async () => {
    await importWorkbook(await workbook());
    const { sheets } = await importWorkbook(await workbook({ extraRow: true }));

    expect(sheets[0]).toMatchObject({ lineCount: 4, replaced: true });
    expect(await listImportBatches(deps(), admin)).toHaveLength(1);
    const { issues } = await importIssues(deps(), admin, sheets[0]?.batchId);
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["MISSING_EXCHANGE_RATE", "SHEET_TOTAL_MISMATCH", "CUSTOMER_NOT_IN_SUMMARY"]),
    );
  });

  it("rejects files that aren't Excel workbooks", async () => {
    await expect(importWorkbook(new TextEncoder().encode("hola"), admin, "ventas.csv")).rejects.toMatchObject(
      { code: "INVALID_FILE" },
    );
    await expect(importWorkbook(new TextEncoder().encode("hola"))).rejects.toMatchObject({
      code: "INVALID_FILE",
    });
  });

  it("only lets administration and management import", async () => {
    await expect(importWorkbook(await workbook(), technician)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      portfolioStatementFromImport(deps(), actorWithRole("warehouse_keeper"), crypto.randomUUID()),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
