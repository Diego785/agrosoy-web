import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { salesWorkbook } from "@test/sales-workbook";
import { testDb } from "@test/test-database";
import { createCampaign } from "@/modules/campaigns/application/campaign-use-cases";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { customerStatement } from "@/modules/receivables/application/statement-use-cases";
import { drizzleStatementReader } from "@/modules/receivables/infrastructure/drizzle-statement-reader";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { conversionPreview, convertCustomers, convertProducts } from "../application/conversion";
import { importSalesWorkbook } from "../application/import-use-cases";
import { convertSales, salesReconciliation, undoSalesConversion } from "../application/sales-conversion";
import { conversionDeps, salesConversionDeps } from "./conversion-adapters";
import { drizzleImportRepository } from "./drizzle-import-repository";
import { exceljsWorkbookReader } from "./exceljs-workbook-reader";

const admin = actorWithRole("admin");
const importDeps = () => ({
  imports: drizzleImportRepository(testDb),
  workbooks: exceljsWorkbookReader,
  audit: drizzleAuditTrail(testDb),
});
const statements = { statements: drizzleStatementReader(testDb), today: () => "2026-10-01" };

/** The test sheet imported, its customers converted and its products converted except `leaveOut`. */
async function sheetReadyForSales({ leaveOut }: { leaveOut?: string } = {}) {
  const { sheets } = await importSalesWorkbook(importDeps(), admin, {
    fileName: "ventas.xlsx",
    content: await salesWorkbook(),
  });
  const batchId = sheets[0]!.batchId;
  const { id: campaignId } = await createCampaign(
    { campaigns: drizzleCampaignRepository(testDb), audit: drizzleAuditTrail(testDb) },
    admin,
    { season: "winter", year: 2026, startsOn: "2026-04-01", endsOn: "2026-09-30" },
  );
  const deps = conversionDeps(testDb, admin);
  await convertCustomers(deps, admin, { batchId, technicianId: "" });
  const { products } = await conversionPreview(deps, admin, batchId);
  await convertProducts(deps, admin, {
    batchId,
    decisions: products
      .filter((product) => product.name !== leaveOut)
      .map((product) => ({ key: product.key, line: "fertilizers", saleUnit: "container" })),
  });
  return { batchId, campaignId };
}

const salesInput = (batchId: string, campaignId: string) => ({
  batchId,
  campaignId,
  cutoffDate: "2026-09-30",
  defaultExchangeRate: "6.96",
});

async function balances(batchId: string) {
  const { rows } = await salesReconciliation(salesConversionDeps(testDb, admin), admin, batchId);
  return rows.map((row) => [
    row.customerName,
    row.converted?.balance.toDecimalString() ?? null,
    row.difference.toDecimalString(),
  ]);
}

describe("converting a sheet's sales and payments", () => {
  it("creates imported notes and the summary's payments, and the debts match the sheet", async () => {
    const { batchId, campaignId } = await sheetReadyForSales();
    const result = await convertSales(
      salesConversionDeps(testDb, admin),
      admin,
      salesInput(batchId, campaignId),
    );

    expect(result).toEqual({ notes: 3, entries: 2, skipped: [] });
    expect(await balances(batchId)).toEqual([
      ["Alexander Jimenez", "2200.00", "0.00"],
      ["Andres Kaoru Matsudo", "0.00", "0.00"],
      ["Rodolfo Romero", "679.50", "0.00"],
    ]);

    const { rows } = await salesReconciliation(salesConversionDeps(testDb, admin), admin, batchId);
    const rodolfo = rows.find((row) => row.customerName === "Rodolfo Romero")!;
    const statement = await customerStatement(statements, admin, rodolfo.customerId, {});
    expect(
      statement.lines.map((line) => [line.date, line.noteNumber, line.kind, line.amount, line.fromSheet]),
    ).toEqual([
      ["2026-05-29", 11599, "delivery", "780.00", false],
      ["2026-09-30", null, "payment", "100.50", true],
    ]);
  });

  it("reports rows it can't place and shows them as differences", async () => {
    const { batchId, campaignId } = await sheetReadyForSales({ leaveOut: "Biogain Amino Como" });
    const result = await convertSales(
      salesConversionDeps(testDb, admin),
      admin,
      salesInput(batchId, campaignId),
    );

    expect(result.skipped).toEqual([
      { row: 7, reason: "product_missing", label: "Biogain Amino Como(1lt.)" },
    ]);
    const { rows, skipped } = await salesReconciliation(salesConversionDeps(testDb, admin), admin, batchId);
    expect(skipped).toEqual(result.skipped);
    expect(rows.find((row) => row.customerName === "Rodolfo Romero")?.difference.toDecimalString()).toBe(
      "780.00",
    );
  });

  it("runs once, blocks re-importing the sheet, and can be undone", async () => {
    const { batchId, campaignId } = await sheetReadyForSales();
    const deps = salesConversionDeps(testDb, admin);
    await convertSales(deps, admin, salesInput(batchId, campaignId));

    await expect(convertSales(deps, admin, salesInput(batchId, campaignId))).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    await expect(
      importSalesWorkbook(importDeps(), admin, { fileName: "ventas.xlsx", content: await salesWorkbook() }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { file: [expect.any(String)] } },
    });

    expect(
      await undoSalesConversion(deps, admin, { batchId, reason: "Faltaba corregir la planilla" }),
    ).toEqual({
      voidedNotes: 3,
    });
    await expect(salesReconciliation(deps, admin, batchId)).rejects.toMatchObject({ code: "INVALID_STATE" });
    const { sheets } = await importSalesWorkbook(importDeps(), admin, {
      fileName: "ventas.xlsx",
      content: await salesWorkbook(),
    });
    expect(sheets).toHaveLength(1);
  });

  it("is for whoever imports sheets", async () => {
    const { batchId, campaignId } = await sheetReadyForSales();
    await expect(
      convertSales(
        salesConversionDeps(testDb, admin),
        actorWithRole("sales_technician"),
        salesInput(batchId, campaignId),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
