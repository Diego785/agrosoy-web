import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { salesWorkbook } from "@test/sales-workbook";
import { testDb } from "@test/test-database";
import { createCampaign } from "@/modules/campaigns/application/campaign-use-cases";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { drizzleZoneRepository } from "@/modules/customers/infrastructure/drizzle-zone-repository";
import { createUser } from "@/modules/identity/application/user-use-cases";
import { drizzleUserDirectory } from "@/modules/identity/infrastructure/drizzle-user-directory";
import { randomPasswordGenerator } from "@/modules/identity/infrastructure/random-password-generator";
import { customerStatement } from "@/modules/receivables/application/statement-use-cases";
import { drizzleStatementReader } from "@/modules/receivables/infrastructure/drizzle-statement-reader";
import { getNote } from "@/modules/sales/application/note-use-cases";
import { correctImportedNote } from "@/modules/sales/application/note-corrections";
import { voidNote } from "@/modules/sales/application/note-lifecycle";
import { drizzleNoteRepository } from "@/modules/sales/infrastructure/drizzle-note-repository";
import { drizzleLedgerRepository } from "@/modules/receivables/infrastructure/drizzle-ledger-repository";
import { noteDeps } from "@test/note-fixtures";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { conversionPreview, convertCustomers, convertProducts } from "../application/conversion";
import { importSalesWorkbook } from "../application/import-use-cases";
import {
  convertSales,
  correctSheetEntry,
  salesReadiness,
  salesReconciliation,
  sheetEntriesOf,
  undoSalesConversion,
} from "../application/sales-conversion";
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

/** A technician who can sign in, as the first step of the conversion assigns them. */
async function technician(name: string) {
  const { id } = await testDb.transaction((tx) =>
    createUser(
      {
        users: drizzleUserDirectory(tx),
        passwords: randomPasswordGenerator,
        audit: drizzleAuditTrail(tx),
        zones: drizzleZoneRepository(tx),
      },
      admin,
      { name, username: "fanez", role: "sales_technician" },
    ),
  );
  return id;
}

/** The test sheet imported, its customers converted and its products converted except `leaveOut`. */
async function sheetReadyForSales({
  leaveOut,
  extraRow = false,
  technicianId = "",
}: { leaveOut?: string; extraRow?: boolean; technicianId?: string } = {}) {
  const { sheets } = await importSalesWorkbook(importDeps(), admin, {
    fileName: "ventas.xlsx",
    content: await salesWorkbook({ extraRow }),
  });
  const batchId = sheets[0]!.batchId;
  const { id: campaignId } = await createCampaign(
    { campaigns: drizzleCampaignRepository(testDb), audit: drizzleAuditTrail(testDb) },
    admin,
    { season: "winter", year: 2026, startsOn: "2026-04-01", endsOn: "2026-09-30" },
  );
  const deps = conversionDeps(testDb, admin);
  await convertCustomers(deps, admin, { batchId, technicianId });
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

    expect(result).toEqual({ notes: 3, entries: 2 });
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

  it("keeps the sheet's rate, and leaves a sale without one when the cell is blank (D35)", async () => {
    const { batchId, campaignId } = await sheetReadyForSales({ extraRow: true });
    const deps = salesConversionDeps(testDb, admin);
    await convertSales(deps, admin, salesInput(batchId, campaignId));

    const { rows } = await salesReconciliation(deps, admin, batchId);
    const rateOf = async (name: string) => {
      const customer = rows.find((row) => row.customerName === name)!;
      const statement = await customerStatement(statements, admin, customer.customerId, {});
      return statement.lines.find((line) => line.kind === "delivery")?.exchangeRate;
    };
    expect(await rateOf("Rodolfo Romero")).toBe("6.9600");
    expect(await rateOf("Eduardo Cuaquira")).toBeNull();
  });

  it("refuses to pass the sales while a product of the sheet is missing (D43)", async () => {
    const { batchId, campaignId } = await sheetReadyForSales({ leaveOut: "Biogain Amino Como" });
    const deps = salesConversionDeps(testDb, admin);

    expect(await salesReadiness(deps, admin, batchId)).toEqual({
      missingCustomers: [],
      missingProducts: ["Biogain Amino Como(1lt.)"],
    });
    await expect(convertSales(deps, admin, salesInput(batchId, campaignId))).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { root: [expect.stringContaining("1 producto (Biogain Amino Como(1lt.))")] } },
    });
    // Nothing was recorded, so there is nothing to reconcile.
    await expect(salesReconciliation(deps, admin, batchId)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("gives each imported note its customer's technician (D43)", async () => {
    const technicianId = await technician("Favio Añez");
    const { batchId, campaignId } = await sheetReadyForSales({ technicianId });
    const deps = salesConversionDeps(testDb, admin);
    expect(await salesReadiness(deps, admin, batchId)).toEqual({ missingCustomers: [], missingProducts: [] });
    await convertSales(deps, admin, salesInput(batchId, campaignId));

    const notes = await deps.notes.importedFrom(batchId);
    const technicians = await Promise.all(
      notes.map(async ({ id }) => (await getNote({ notes: deps.notes }, admin, id)).technician?.name),
    );
    expect(technicians).toEqual(["Favio Añez", "Favio Añez", "Favio Añez"]);
  });

  it("gives the notes the sheet's technician when one is chosen, whoever looks after the customer (D47)", async () => {
    const technicianId = await technician("Favio Añez");
    const { batchId, campaignId } = await sheetReadyForSales();
    const deps = salesConversionDeps(testDb, admin);
    await convertSales(deps, admin, { ...salesInput(batchId, campaignId), technicianId });

    const notes = await deps.notes.importedFrom(batchId);
    const technicians = await Promise.all(
      notes.map(async ({ id }) => (await getNote({ notes: deps.notes }, admin, id)).technician?.name),
    );
    expect(technicians).toEqual(["Favio Añez", "Favio Añez", "Favio Añez"]);
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

describe("correcting what a sheet brought in (D60)", () => {
  const correctionDeps = () => ({
    notes: drizzleNoteRepository(testDb),
    ledger: drizzleLedgerRepository(testDb),
    audit: drizzleAuditTrail(testDb),
  });

  /** The sheet converted, and Rodolfo Romero: his imported note and his statement. */
  async function converted() {
    const { batchId, campaignId } = await sheetReadyForSales();
    await convertSales(salesConversionDeps(testDb, admin), admin, salesInput(batchId, campaignId));
    const { rows } = await salesReconciliation(salesConversionDeps(testDb, admin), admin, batchId);
    const customerId = rows.find((row) => row.customerName === "Rodolfo Romero")!.customerId!;
    const statement = () => customerStatement(statements, admin, customerId, {});
    const noteId = (await statement()).lines.find((line) => line.kind === "delivery")!.document!.id;
    return { batchId, customerId, noteId, statement };
  }

  it("corrects an imported note's price from its own date, and the conciliation marks the customer", async () => {
    const { batchId, noteId, statement } = await converted();
    const [line] = (await getNote(noteDeps(), admin, noteId)).lines;
    const input = {
      reason: "El técnico lo vendió a 38.50",
      lines: [{ lineId: line!.id, quantity: "20", unitPrice: "38.5" }],
    };
    await correctImportedNote(correctionDeps(), admin, noteId, input);

    const note = await getNote(noteDeps(), admin, noteId);
    expect(note.lines.map((corrected) => [corrected.unitPrice, corrected.total])).toEqual([
      ["38.5000", "770.00"],
    ]);
    expect(note.corrected).toMatchObject({ reason: "El técnico lo vendió a 38.50" });
    // One delivery on the note's own date: the reversed pair stays off the statement.
    expect((await statement()).lines.map((shown) => [shown.date, shown.kind, shown.amount])).toEqual([
      ["2026-05-29", "delivery", "770.00"],
      ["2026-09-30", "payment", "100.50"],
    ]);
    const { rows } = await salesReconciliation(salesConversionDeps(testDb, admin), admin, batchId);
    expect(rows.find((row) => row.customerName === "Rodolfo Romero")).toMatchObject({ corrected: true });
    expect(rows.find((row) => row.customerName === "Alexander Jimenez")).toMatchObject({ corrected: false });

    await expect(
      correctImportedNote(correctionDeps(), admin, noteId, {
        ...input,
        lines: [{ ...input.lines[0]!, unitPrice: "38.50" }],
      }),
    ).rejects.toMatchObject({
      details: { fieldErrors: { root: ["No cambiaste ningún precio ni cantidad."] } },
    });
    await expect(
      correctImportedNote(correctionDeps(), actorWithRole("sales_technician"), noteId, input),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("doesn't mark a sheet undone and passed again as corrected", async () => {
    const { batchId, campaignId } = await sheetReadyForSales();
    const deps = salesConversionDeps(testDb, admin);
    await convertSales(deps, admin, salesInput(batchId, campaignId));
    await undoSalesConversion(deps, admin, { batchId, reason: "Se corrige la planilla" });
    await convertSales(deps, admin, salesInput(batchId, campaignId));
    const { rows } = await salesReconciliation(deps, admin, batchId);
    expect(rows.map((row) => row.corrected)).toEqual(rows.map(() => false));
  });

  it("voids an imported note on its own", async () => {
    const { noteId, statement } = await converted();
    await voidNote(noteDeps(), admin, noteId, { reason: "Se cargó por error en la planilla" });
    expect((await getNote(noteDeps(), admin, noteId)).status).toBe("voided");
    expect((await statement()).lines.map((shown) => shown.kind)).toEqual(["payment"]);
  });

  it("corrects a payment the sheet brought in, and zero leaves it out", async () => {
    const { batchId, customerId, statement } = await converted();
    const entries = async () =>
      (await sheetEntriesOf(salesConversionDeps(testDb, admin), admin, { batchId, customerId })).entries;
    const [payment] = await entries();
    expect(payment).toMatchObject({ kind: "payment", date: "2026-09-30", amount: "100.50" });

    const correct = (amount: string) =>
      correctSheetEntry(salesConversionDeps(testDb, admin), admin, {
        batchId,
        entryId: payment!.id,
        amount,
        reason: "El pago fue de 120",
      });
    await correct("120");
    expect((await statement()).totals.balance).toBe("660.00");
    const [corrected] = await entries();
    await expect(
      correctSheetEntry(salesConversionDeps(testDb, admin), admin, {
        batchId,
        entryId: corrected!.id,
        amount: "120.00",
        reason: "Otra vez",
      }),
    ).rejects.toMatchObject({ details: { fieldErrors: { amount: ["Es el mismo monto."] } } });
    await correctSheetEntry(salesConversionDeps(testDb, admin), admin, {
      batchId,
      entryId: corrected!.id,
      amount: "0",
      reason: "No hubo pago",
    });
    expect(await entries()).toEqual([]);
    expect((await statement()).totals.balance).toBe("780.00");

    // Undoing the sheet still reverses everything it left standing.
    await undoSalesConversion(salesConversionDeps(testDb, admin), admin, {
      batchId,
      reason: "Se vuelve a importar",
    });
    expect((await statement()).totals.balance).toBe("0.00");
  });
});
