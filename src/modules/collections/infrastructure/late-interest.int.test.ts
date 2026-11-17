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
    graceDays: "30",
    startsOn: "2026-11-01",
    ...overrides,
  });

const proposed = async (today: string) =>
  (await pendingInterest(interestDeps(today), admin)).proposals.map((proposal) => [
    proposal.customer.name,
    proposal.month,
    proposal.baseUsd,
    proposal.usdAmount,
  ]);

const chosen = async (today: string, name: string) => {
  const { proposals } = await pendingInterest(interestDeps(today), admin);
  return proposals
    .filter((proposal) => proposal.customer.name === name)
    .map(({ key, usdAmount }) => ({ key, usdAmount }));
};

const pay = (customerId: string, campaignId: string, paymentDate: string, amount: string) =>
  recordPayment(collectionDeps(), admin, {
    customerId,
    paymentDate,
    amount,
    exchangeRate: "6.96",
    currency: "USD",
    method: "transfer",
    target: "campaign",
    campaignId,
  });

describe("late-payment interest, month by month (D38)", () => {
  it("proposes nothing until administration sets when it starts, then each month once it ends", async () => {
    const { ids, winterId } = await seed();
    expect(await proposed("2027-02-01")).toEqual([]);

    await startInterest();
    // December is free with 30 days' grace.
    expect(await proposed("2027-01-31")).toEqual([]);
    // Tito paid part before the due date; Roberto has until 20 December, so January is free too.
    await pay(ids.otherId, winterId, "2026-11-20", "400");
    await extendDueDate(ids.customerId, winterId, "2026-12-20");
    expect(await proposed("2027-02-01")).toEqual([["Tito Cruz", "2027-01", "600.00", "18.00"]]);
    expect(await proposed("2027-03-01")).toEqual([
      ["Roberto Mamani", "2027-02", "2200.00", "66.00"],
      ["Tito Cruz", "2027-01", "600.00", "18.00"],
      ["Tito Cruz", "2027-02", "600.00", "18.00"],
    ]);
  });

  it("charges on the month's last day, and a later payment covers that interest before capital", async () => {
    const { ids, winterId } = await seed();
    await startInterest();
    const { charged } = await chargeInterest(interestDeps("2027-02-03"), admin, {
      proposals: await chosen("2027-02-03", "Roberto Mamani"),
    });
    expect(charged).toBe(1);
    expect(await proposed("2027-02-03")).toEqual([["Tito Cruz", "2027-01", "1000.00", "30.00"]]);

    await pay(ids.customerId, winterId, "2027-02-10", "1000");
    const statement = await customerStatement(
      { statements: drizzleStatementReader(testDb), today: () => "2027-02-10" },
      admin,
      ids.customerId,
      {},
    );
    expect(statement.totals.balance).toBe("1266.00");
    const [interest, payment] = statement.lines.slice(-2);
    expect([interest!.date, describeLine(interest!).text]).toEqual([
      "2027-01-31",
      "Interés: 3 % por mora de enero de 2027 sobre US$ 2.200,00",
    ]);
    expect(describeLine(payment!).note).toBe("US$ 66,00 a interés y US$ 934,00 a capital");
    expect(statement.byCampaign?.[0]?.interestOwed).toBe("0.00");
    // February's interest is on the capital left.
    expect((await proposed("2027-03-01")).filter(([name]) => name === "Roberto Mamani")).toEqual([
      ["Roberto Mamani", "2027-02", "1266.00", "37.98"],
    ]);

    // Voiding the charge doesn't bring January back: it was decided.
    const { items } = await listCharges(collectionDeps(), admin, {});
    await voidCharge(collectionDeps("2027-03-01"), admin, items[0]!.id, { reason: "Se le perdonó" });
    expect((await proposed("2027-03-01")).map(([name, month]) => `${name} ${month}`)).toEqual([
      "Roberto Mamani 2027-02",
      "Tito Cruz 2027-01",
      "Tito Cruz 2027-02",
    ]);
  });

  it("refuses an amount that changed since the list was opened, and waives for good", async () => {
    const { ids, winterId } = await seed();
    await startInterest({ ratePercent: "2,5" });
    const seen = await chosen("2027-02-02", "Tito Cruz");
    expect(seen.map((proposal) => proposal.usdAmount)).toEqual(["25.00"]);
    // A paper receipt from January is typed in meanwhile.
    await pay(ids.otherId, winterId, "2027-01-28", "200");
    await expect(
      chargeInterest(interestDeps("2027-02-02"), admin, { proposals: seen }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { proposals: expect.any(Array) } },
    });

    const { waived } = await waiveInterest(interestDeps("2027-02-02"), admin, {
      proposals: await chosen("2027-02-02", "Tito Cruz"),
    });
    expect(waived).toBe(1);
    expect((await proposed("2027-02-02")).map(([name]) => name)).toEqual(["Roberto Mamani"]);
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
