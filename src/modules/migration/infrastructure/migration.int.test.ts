import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { salesWorkbook } from "@test/sales-workbook";
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

describe("spreadsheet import", () => {
  it("imports the sales sheet, skips sheets without a sales table and records it", async () => {
    const result = await importWorkbook(await salesWorkbook());

    expect(result.skippedSheets).toEqual(["Notas"]);
    expect(result.sheets).toMatchObject([
      { sheetName: "Ing. Favio Añez", campaignLabel: "CAMPAÑA INVIERNO 2026", lineCount: 3, replaced: false },
    ]);
    const [batch] = await listImportBatches(deps(), admin);
    expect(batch).toMatchObject({ lineCount: 3, customerCount: 3, campaignLabel: "CAMPAÑA INVIERNO 2026" });
    expect(await testDb.$count(auditLog)).toBe(1);
  });

  it("builds the portfolio statement with the same columns as the sheet's summary", async () => {
    const { sheets } = await importWorkbook(await salesWorkbook());
    const statement = await portfolioStatementFromImport(deps(), technician, sheets[0]?.batchId);

    expect(statement.source).toEqual({
      label: "Ing. Favio Añez",
      campaignLabel: "CAMPAÑA INVIERNO 2026",
      isPreview: true,
    });
    expect(statement.customers).toMatchObject([
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
    const { sheets } = await importWorkbook(await salesWorkbook());
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
    await importWorkbook(await salesWorkbook());
    const { sheets } = await importWorkbook(await salesWorkbook({ extraRow: true }));

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
    await expect(importWorkbook(await salesWorkbook(), technician)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      portfolioStatementFromImport(deps(), actorWithRole("warehouse_keeper"), crypto.randomUUID()),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
