import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { collectionDeps, seedNoteFixtures } from "@test/note-fixtures";
import { testDb } from "@test/test-database";
import { createCampaign } from "@/modules/campaigns/application/campaign-use-cases";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { customerStatement } from "@/modules/receivables/application/statement-use-cases";
import { drizzleStatementReader } from "@/modules/receivables/infrastructure/drizzle-statement-reader";
import { describeLine } from "@/modules/receivables/presentation/statement-text";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import {
  listOpeningBalances,
  recordOpeningBalance,
  voidOpeningBalance,
} from "../application/opening-balances";

const admin = actorWithRole("admin");
const statementOn = (today: string) => ({ statements: drizzleStatementReader(testDb), today: () => today });

/** Winter 2026 (closed later, it still takes old debt) and the fixtures' summer. */
async function seed() {
  const ids = await seedNoteFixtures();
  const { id: winterId } = await createCampaign(
    { campaigns: drizzleCampaignRepository(testDb), audit: drizzleAuditTrail(testDb) },
    admin,
    { season: "winter", year: 2026, startsOn: "2026-04-01", endsOn: "2026-09-30" },
  );
  return { ids, winterId };
}

describe("opening balances (D29)", () => {
  it("carries a customer's debt into the ledger and shows it in the statement", async () => {
    const { ids, winterId } = await seed();
    await recordOpeningBalance(collectionDeps(), admin, {
      customerId: ids.customerId,
      campaignId: winterId,
      balanceDate: "2026-10-01",
      amount: "1500",
      note: "Según la planilla de Favio",
    });

    const statement = await customerStatement(statementOn("2026-11-02"), admin, ids.customerId, {});
    expect(statement.totals).toMatchObject({ other: "1500.00", balance: "1500.00", status: "owing" });
    const [line] = statement.lines;
    expect(line && describeLine(line)).toEqual({ text: "Saldo inicial", note: "Según la planilla de Favio" });
    // Overdue after winter's due date, like any winter debt (D37).
    expect((await customerStatement(statementOn("2026-12-01"), admin, ids.customerId, {})).overdue).toBe(
      "1500.00",
    );
  });

  it("can start in the customer's favor, one per campaign, and is voided with a reversal", async () => {
    const { ids, winterId } = await seed();
    const input = { customerId: ids.customerId, campaignId: winterId, balanceDate: "2026-10-01" };
    const { id } = await recordOpeningBalance(collectionDeps(), admin, {
      ...input,
      amount: "200",
      direction: "in_favor",
    });
    expect(
      (await customerStatement(statementOn("2026-11-02"), admin, ids.customerId, {})).totals,
    ).toMatchObject({
      balance: "-200.00",
      status: "settled",
    });
    await expect(
      recordOpeningBalance(collectionDeps(), admin, { ...input, amount: "50" }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { campaignId: expect.any(Array) } },
    });

    await voidOpeningBalance(collectionDeps("2026-11-03"), admin, id, {
      reason: "Era a favor de otro cliente",
    });
    const after = await customerStatement(statementOn("2026-11-03"), admin, ids.customerId, {});
    expect(after.totals.balance).toBe("0.00");
    expect(after.lines.map((line) => describeLine(line).text)).toEqual([
      "Saldo inicial a favor del cliente",
      "Anulación del saldo inicial",
    ]);
    // Voided, the campaign takes the right one.
    await recordOpeningBalance(collectionDeps(), admin, { ...input, amount: "50" });
    const { items } = await listOpeningBalances(collectionDeps(), admin, {});
    expect(items.map((item) => [item.status, item.usdAmount])).toEqual([
      ["recorded", "50.00"],
      ["voided", "-200.00"],
    ]);
  });

  it("is for administration only", async () => {
    const { ids, winterId } = await seed();
    await expect(
      recordOpeningBalance(collectionDeps(), actorWithRole("sales_technician"), {
        customerId: ids.customerId,
        campaignId: winterId,
        balanceDate: "2026-10-01",
        amount: "100",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
