import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { collectionDeps, seedNoteFixtures } from "@test/note-fixtures";
import { testDb } from "@test/test-database";
import { createCampaign } from "@/modules/campaigns/application/campaign-use-cases";
import { setDueDateExtension } from "@/modules/campaigns/application/due-date-extensions";
import {
  customerExistence,
  drizzleCampaignRepository,
  drizzleDueDateExtensionRepository,
} from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { customerStatement } from "@/modules/receivables/application/statement-use-cases";
import { drizzleLedgerRepository } from "@/modules/receivables/infrastructure/drizzle-ledger-repository";
import { drizzleStatementReader } from "@/modules/receivables/infrastructure/drizzle-statement-reader";
import { describeLine } from "@/modules/receivables/presentation/statement-text";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { drizzleSettingsStore } from "@/shared/infrastructure/db/app-settings";
import { listCharges, recordPayment, voidCharge } from "../application/collection-use-cases";
import {
  chargeInterest,
  pendingInterest,
  updateInterestSettings,
  waiveInterest,
} from "../application/late-interest";
import { recordOpeningBalance } from "../application/opening-balances";
import { drizzleChargeRepository } from "./drizzle-collection-repositories";
import { drizzleLateInterestRepository } from "./drizzle-late-interest-repository";

const admin = actorWithRole("admin");

const interestDeps = (today: string) => ({
  interest: drizzleLateInterestRepository(testDb),
  charges: drizzleChargeRepository(testDb),
  ledger: drizzleLedgerRepository(testDb),
  settings: drizzleSettingsStore(testDb),
  audit: drizzleAuditTrail(testDb),
  today: () => today,
});

/** Winter 2026 (due 30/11/2026) with Roberto owing US$ 2.200 and Tito US$ 1.000 in it. */
async function seed() {
  const ids = await seedNoteFixtures();
  const { id: winterId } = await createCampaign(
    { campaigns: drizzleCampaignRepository(testDb), audit: drizzleAuditTrail(testDb) },
    admin,
    { season: "winter", year: 2026, startsOn: "2026-04-01", endsOn: "2026-09-30" },
  );
  for (const [customerId, amount] of [
    [ids.customerId, "2200"],
    [ids.otherId, "1000"],
  ] as const) {
    await recordOpeningBalance(collectionDeps(), admin, {
      customerId,
      campaignId: winterId,
      balanceDate: "2026-09-30",
      amount,
    });
  }
  return { ids, winterId };
}

/** Gives the customer until `dueOn` to pay the campaign's debt (D37). */
const extendDueDate = (customerId: string, campaignId: string, dueOn: string) =>
  setDueDateExtension(
    {
      campaigns: drizzleCampaignRepository(testDb),
      extensions: drizzleDueDateExtensionRepository(testDb),
      customers: customerExistence(testDb),
      audit: drizzleAuditTrail(testDb),
    },
    admin,
    { customerId, campaignId, dueOn, reason: "Cosecha tardía" },
  );

const startInterest = (overrides: object = {}) =>
  updateInterestSettings(interestDeps("2026-11-11"), admin, {
    ratePercent: "3",
    graceDays: "0",
    startsOn: "2026-11-01",
    ...overrides,
  });

const proposed = async (today: string) =>
  (await pendingInterest(interestDeps(today), admin)).proposals.map((proposal) => [
    proposal.customer.name,
    proposal.interestDate,
    proposal.baseUsd,
    proposal.usdAmount,
  ]);

const chosen = async (today: string, name: string) => {
  const { proposals } = await pendingInterest(interestDeps(today), admin);
  return proposals
    .filter((proposal) => proposal.customer.name === name)
    .map(({ key, usdAmount }) => ({ key, usdAmount }));
};

describe("late-payment interest (D38)", () => {
  it("proposes nothing until administration sets when it starts, then once the due date passes", async () => {
    const { ids, winterId } = await seed();
    expect(await proposed("2026-12-01")).toEqual([]);

    await startInterest();
    expect(await proposed("2026-11-30")).toEqual([]);
    // Tito paid part before the due date; Roberto has until 20 December.
    await recordPayment(collectionDeps(), admin, {
      customerId: ids.otherId,
      paymentDate: "2026-11-20",
      amount: "400",
      exchangeRate: "6.96",
      currency: "USD",
      method: "transfer",
      target: "campaign",
      campaignId: winterId,
    });
    await extendDueDate(ids.customerId, winterId, "2026-12-20");
    expect(await proposed("2026-12-01")).toEqual([["Tito Cruz", "2026-11-30", "600.00", "18.00"]]);
    expect(await proposed("2026-12-21")).toEqual([
      ["Roberto Mamani", "2026-12-20", "2200.00", "66.00"],
      ["Tito Cruz", "2026-11-30", "600.00", "18.00"],
    ]);
  });

  it("charges the chosen ones into the statement, dated the day they are confirmed, and doesn't propose them again", async () => {
    const { ids, winterId } = await seed();
    await startInterest();
    const { charged } = await chargeInterest(interestDeps("2026-12-03"), admin, {
      proposals: await chosen("2026-12-03", "Roberto Mamani"),
    });
    expect(charged).toBe(1);
    expect(await proposed("2026-12-03")).toEqual([["Tito Cruz", "2026-11-30", "1000.00", "30.00"]]);

    const statement = await customerStatement(
      { statements: drizzleStatementReader(testDb), today: () => "2026-12-03" },
      admin,
      ids.customerId,
      {},
    );
    expect(statement.totals.balance).toBe("2266.00");
    const line = statement.lines.at(-1)!;
    expect([line.date, describeLine(line).text]).toEqual([
      "2026-12-03",
      "Interés: 3 % por mora sobre US$ 2.200,00 adeudados al 30/11/2026",
    ]);

    // Voiding it doesn't bring the proposal back: it was decided.
    const { items } = await listCharges(collectionDeps(), admin, {});
    await voidCharge(collectionDeps("2026-12-04"), admin, items[0]!.id, { reason: "Se le perdonó" });
    expect(await proposed("2026-12-04")).toEqual([["Tito Cruz", "2026-11-30", "1000.00", "30.00"]]);

    // Nor does more time given afterwards: the same due date doesn't charge twice.
    await extendDueDate(ids.customerId, winterId, "2026-12-20");
    expect(await proposed("2026-12-21")).toEqual([["Tito Cruz", "2026-11-30", "1000.00", "30.00"]]);
  });

  it("charges again when the next campaign falls due, leaving earlier interest out of the base", async () => {
    await seed();
    await startInterest();
    await chargeInterest(interestDeps("2026-12-03"), admin, {
      proposals: await chosen("2026-12-03", "Roberto Mamani"),
    });
    // Summer 2026 is due on 31 May 2027; Roberto still owes winter, interest aside.
    expect((await proposed("2027-06-01")).filter(([name]) => name === "Roberto Mamani")).toEqual([
      ["Roberto Mamani", "2027-05-31", "2200.00", "66.00"],
    ]);
  });

  it("refuses an amount that changed since the list was opened, and waives for good", async () => {
    const { ids, winterId } = await seed();
    await startInterest({ ratePercent: "2,5" });
    const seen = await chosen("2026-12-02", "Tito Cruz");
    expect(seen.map((proposal) => proposal.usdAmount)).toEqual(["25.00"]);
    // A paper receipt from before the due date is typed in meanwhile.
    await recordPayment(collectionDeps(), admin, {
      customerId: ids.otherId,
      paymentDate: "2026-11-28",
      amount: "200",
      exchangeRate: "6.96",
      currency: "USD",
      method: "cash",
      target: "campaign",
      campaignId: winterId,
    });
    await expect(
      chargeInterest(interestDeps("2026-12-02"), admin, { proposals: seen }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { proposals: expect.any(Array) } },
    });

    const { waived } = await waiveInterest(interestDeps("2026-12-02"), admin, {
      proposals: await chosen("2026-12-02", "Tito Cruz"),
    });
    expect(waived).toBe(1);
    expect((await proposed("2026-12-02")).map(([name]) => name)).toEqual(["Roberto Mamani"]);
    expect((await listCharges(collectionDeps(), admin, {})).total).toBe(0);
  });

  it("checks the settings and is for administration", async () => {
    await seed();
    await expect(startInterest({ ratePercent: "0" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { ratePercent: expect.any(Array) } },
    });
    await expect(startInterest({ graceDays: "400" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { graceDays: expect.any(Array) } },
    });
    await startInterest({ ratePercent: "03,50", graceDays: "15" });
    expect((await pendingInterest(interestDeps("2026-12-01"), admin)).settings).toEqual({
      ratePercent: "3.5",
      graceDays: 15,
      startsOn: "2026-11-01",
    });
    await expect(
      pendingInterest(interestDeps("2026-12-01"), actorWithRole("sales_technician")),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
