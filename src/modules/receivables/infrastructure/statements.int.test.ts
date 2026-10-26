import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import {
  collectionDeps,
  draftInput,
  noteDeps,
  seedNoteFixtures,
  type NoteFixtures,
} from "@test/note-fixtures";
import { testDb } from "@test/test-database";
import { createCampaign } from "@/modules/campaigns/application/campaign-use-cases";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { recordCharge, recordPayment } from "@/modules/collections/application/collection-use-cases";
import { confirmNote, voidNote } from "@/modules/sales/application/note-lifecycle";
import { createDraftNote } from "@/modules/sales/application/note-use-cases";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { customerStatement, portfolioStatement } from "../application/statement-use-cases";
import { drizzleStatementReader } from "./drizzle-statement-reader";

const admin = actorWithRole("admin");
const technician = actorWithRole("sales_technician");
const deps = { statements: drizzleStatementReader(testDb), today: () => "2026-11-02" };

async function confirmed(ids: NoteFixtures, overrides: object = {}) {
  const { id } = await createDraftNote(noteDeps(), technician, draftInput(ids, overrides));
  await confirmNote(noteDeps(), technician, id, { paperNumber: "" });
  return id;
}

/** Roberto: a winter note paid in full, a summer note partly paid, a charge and a voided note. */
async function seedHistory() {
  const ids = await seedNoteFixtures();
  const { id: winterId } = await createCampaign(
    { campaigns: drizzleCampaignRepository(testDb), audit: drizzleAuditTrail(testDb) },
    admin,
    { season: "winter", year: 2026, startsOn: "2026-04-01", endsOn: "2026-09-30" },
  );
  await confirmed(ids, { noteDate: "2026-05-10" });
  await confirmed(ids, { noteDate: "2026-10-26" });
  const voided = await confirmed(ids, {
    noteDate: "2026-10-27",
    lines: [{ presentationId: ids.energy, quantity: "4", unitPrice: "62.5", freeOfCharge: "" }],
  });
  await voidNote(noteDeps("2026-10-28"), admin, voided, { reason: "Se cargó dos veces" });
  await recordPayment(collectionDeps(), admin, {
    customerId: ids.customerId,
    paymentDate: "2026-11-01",
    amount: "20880",
    exchangeRate: "6.96",
    currency: "BOB",
    method: "transfer",
    target: "oldest_debt",
  });
  const summer = (await collectionDeps().lookups.campaignOn("2026-11-01"))!.id;
  await recordCharge(collectionDeps(), admin, {
    customerId: ids.customerId,
    campaignId: summer,
    chargeDate: "2026-11-02",
    amount: "50",
    reason: "Interés acordado",
  });
  return { ids, winterId, summer };
}

describe("customer statement", () => {
  it("lists every movement with the sheet's columns, per campaign and aged", async () => {
    const { ids } = await seedHistory();
    const statement = await customerStatement(deps, technician, ids.customerId, {});

    expect(statement.totals).toEqual({
      delivered: "4400.00",
      paid: "3000.00",
      returned: "0.00",
      other: "50.00",
      balance: "1450.00",
      status: "owing",
    });
    expect(
      statement.lines.map((line) => [
        line.date,
        line.kind,
        line.noteNumber,
        line.description,
        line.amount,
        line.isReversal,
      ]),
    ).toEqual([
      ["2026-05-10", "delivery", 1, "Fulvin 40-22", "2200.00", false],
      ["2026-05-10", "delivery", 1, "4-energy", "0.00", false],
      ["2026-10-26", "delivery", 2, "Fulvin 40-22", "2200.00", false],
      ["2026-10-26", "delivery", 2, "4-energy", "0.00", false],
      ["2026-10-27", "delivery", 3, "4-energy", "250.00", false],
      ["2026-10-28", "delivery", 3, "", "-250.00", true],
      ["2026-11-01", "payment", null, "", "2200.00", false],
      ["2026-11-01", "payment", null, "", "800.00", false],
      ["2026-11-02", "charge", null, "Interés acordado", "50.00", false],
    ]);
    expect(statement.lines[6]?.receipt).toEqual({
      number: 1,
      method: "transfer",
      currency: "BOB",
      amount: "20880.00",
    });
    expect(statement.byCampaign?.map((row) => [row.season, row.totals.balance])).toEqual([
      ["winter", "0.00"],
      ["summer", "1450.00"],
    ]);
    expect(statement.aging).toEqual({ upTo30: "1450.00", upTo60: "0.00", upTo90: "0.00", over90: "0.00" });
  });

  it("can be limited to one campaign", async () => {
    const { ids, winterId } = await seedHistory();
    const statement = await customerStatement(deps, admin, ids.customerId, { campaignId: winterId });
    expect(statement.totals).toMatchObject({
      delivered: "2200.00",
      paid: "2200.00",
      balance: "0.00",
      status: "settled",
    });
  });
});

describe("portfolio statement", () => {
  it("adds up every customer and starts technicians on their own portfolio", async () => {
    await seedHistory();
    expect((await portfolioStatement(deps, technician, {})).customers).toEqual([]);

    const statement = await portfolioStatement(deps, technician, { technicianId: "all" });
    expect(statement.customers).toMatchObject([
      { name: "Roberto Mamani", totals: { balance: "1450.00", status: "owing" }, over90: null },
    ]);
    expect(statement.totals.balance).toBe("1450.00");
    expect(statement.collectedPerMille).toBe(682);
  });

  it("filters customers who owe and shows debt older than 90 days", async () => {
    const ids = await seedNoteFixtures();
    await createCampaign(
      { campaigns: drizzleCampaignRepository(testDb), audit: drizzleAuditTrail(testDb) },
      admin,
      { season: "winter", year: 2026, startsOn: "2026-04-01", endsOn: "2026-09-30" },
    );
    await confirmed(ids, { noteDate: "2026-05-10" });
    await confirmed(ids, { customerId: ids.otherId, propertyId: "", noteDate: "2026-10-26" });
    await recordPayment(collectionDeps(), admin, {
      customerId: ids.otherId,
      paymentDate: "2026-11-01",
      amount: "2200",
      exchangeRate: "6.96",
      currency: "USD",
      method: "cash",
      target: "oldest_debt",
    });

    const owing = await portfolioStatement(deps, admin, { status: "owing" });
    expect(owing.customers).toMatchObject([{ name: "Roberto Mamani", over90: "2200.00" }]);
  });
});
