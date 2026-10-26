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
import { confirmNote, voidNote } from "@/modules/sales/application/note-lifecycle";
import { createDraftNote } from "@/modules/sales/application/note-use-cases";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import {
  dailyRate,
  getPayment,
  recordCharge,
  recordPayment,
  setDailyRate,
  voidCharge,
  voidPayment,
} from "../application/collection-use-cases";
import { collectionLookups } from "./collection-lookups";

const admin = actorWithRole("admin");
const technician = actorWithRole("sales_technician");

/** Adds winter 2026 (April–September), so a customer can owe in two campaigns. */
async function seedWinter() {
  const { id } = await createCampaign(
    { campaigns: drizzleCampaignRepository(testDb), audit: drizzleAuditTrail(testDb) },
    admin,
    { season: "winter", year: 2026, startsOn: "2026-04-01", endsOn: "2026-09-30" },
  );
  return id;
}

/** A confirmed credit note of US$ 2.200 for Roberto, dated `noteDate`. */
async function confirmedNote(ids: NoteFixtures, noteDate = "2026-10-26", overrides: object = {}) {
  const { id } = await createDraftNote(noteDeps(), technician, draftInput(ids, { noteDate, ...overrides }));
  await confirmNote(noteDeps(), technician, id, { paperNumber: "" });
  return id;
}

async function balances(customerId: string) {
  const rows = await collectionLookups(testDb).balances(customerId);
  return Object.fromEntries(rows.map((row) => [row.startsOn, row.balance.toDecimalString()]));
}

const payment = (ids: NoteFixtures, overrides: object = {}) => ({
  customerId: ids.customerId,
  paymentDate: "2026-11-02",
  amount: "3000",
  exchangeRate: "6.96",
  currency: "USD",
  method: "transfer",
  reference: "BNB 123",
  target: "oldest_debt",
  ...overrides,
});

describe("payments", () => {
  it("pays the oldest campaign first and gives receipt numbers in order", async () => {
    const ids = await seedNoteFixtures();
    await seedWinter();
    await confirmedNote(ids, "2026-05-10");
    await confirmedNote(ids, "2026-10-26");

    const first = await recordPayment(collectionDeps(), admin, payment(ids));
    expect(first.receiptNumber).toBe(1);
    expect(await balances(ids.customerId)).toEqual({ "2026-04-01": "0.00", "2026-10-01": "1400.00" });

    const view = await getPayment(collectionDeps(), admin, first.id);
    expect(view).toMatchObject({
      usdAmount: "3000.00",
      currency: "USD",
      method: "transfer",
      status: "recorded",
    });
    expect(view.allocations.map((allocation) => [allocation.campaign.season, allocation.usdAmount])).toEqual([
      ["winter", "2200.00"],
      ["summer", "800.00"],
    ]);

    const second = await recordPayment(collectionDeps(), admin, payment(ids, { amount: "100" }));
    expect(second.receiptNumber).toBe(2);
  });

  it("converts bolivianos at the payment's rate and can apply it to one note", async () => {
    const ids = await seedNoteFixtures();
    const noteId = await confirmedNote(ids);
    const { id } = await recordPayment(
      collectionDeps(),
      admin,
      payment(ids, { currency: "BOB", amount: "696", target: "note", noteId }),
    );
    const view = await getPayment(collectionDeps(), admin, id);
    expect(view).toMatchObject({ amount: "696.00", currency: "BOB", usdAmount: "100.00" });
    expect(view.allocations).toMatchObject([{ note: { id: noteId, number: 1 }, usdAmount: "100.00" }]);
    expect(await balances(ids.customerId)).toEqual({ "2026-10-01": "2100.00" });
  });

  it("keeps an overpayment as a credit in favor and rejects notes of other customers", async () => {
    const ids = await seedNoteFixtures();
    const noteId = await confirmedNote(ids);
    await recordPayment(collectionDeps(), admin, payment(ids, { amount: "2500" }));
    expect(await balances(ids.customerId)).toEqual({ "2026-10-01": "-300.00" });

    await expect(
      recordPayment(
        collectionDeps(),
        admin,
        payment(ids, { customerId: ids.otherId, target: "note", noteId }),
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { noteId: [expect.any(String)] } },
    });
  });

  it("gives the credit back to the debt when a payment is voided", async () => {
    const ids = await seedNoteFixtures();
    await confirmedNote(ids);
    const { id } = await recordPayment(collectionDeps(), admin, payment(ids, { amount: "500" }));
    await voidPayment(collectionDeps("2026-11-03"), admin, id, { reason: "Transferencia rechazada" });

    expect(await balances(ids.customerId)).toEqual({ "2026-10-01": "2200.00" });
    expect(await getPayment(collectionDeps(), admin, id)).toMatchObject({
      status: "voided",
      voided: { reason: "Transferencia rechazada" },
    });
    await expect(
      voidPayment(collectionDeps(), admin, id, { reason: "Otra vez por error" }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("is for administration only and needs a description when paid in kind", async () => {
    const ids = await seedNoteFixtures();
    await expect(recordPayment(collectionDeps(), technician, payment(ids))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      recordPayment(collectionDeps(), admin, payment(ids, { method: "in_kind" })),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      recordPayment(collectionDeps(), admin, payment(ids, { paymentDate: "2026-09-01" })),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { paymentDate: [expect.any(String)] } },
    });
  });
});

describe("cash notes", () => {
  it("are confirmed with their payment, which settles them exactly", async () => {
    const ids = await seedNoteFixtures();
    const { id } = await createDraftNote(noteDeps(), technician, draftInput(ids, { paymentTerms: "cash" }));
    await expect(confirmNote(noteDeps(), technician, id, { paperNumber: "" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });

    const confirmed = await confirmNote(noteDeps(), technician, id, {
      paperNumber: "",
      payment: { currency: "BOB", method: "cash" },
    });
    expect(confirmed).toEqual({ number: 1, receiptNumber: 1 });
    expect(await balances(ids.customerId)).toEqual({ "2026-10-01": "0.00" });

    const [paymentId] = await collectionDeps().payments.settling(id);
    expect(await getPayment(collectionDeps(), admin, paymentId)).toMatchObject({
      currency: "BOB",
      amount: "15312.00",
      usdAmount: "2200.00",
      settlesNote: { id, number: 1 },
    });
    await expect(
      voidPayment(collectionDeps(), admin, paymentId, { reason: "Intento directo" }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("void their payment together with the note", async () => {
    const ids = await seedNoteFixtures();
    const { id } = await createDraftNote(noteDeps(), technician, draftInput(ids, { paymentTerms: "cash" }));
    await confirmNote(noteDeps(), technician, id, {
      paperNumber: "",
      payment: { currency: "USD", method: "qr" },
    });
    await voidNote(noteDeps(), admin, id, { reason: "Se devolvió todo el producto" });

    expect(await balances(ids.customerId)).toEqual({ "2026-10-01": "0.00" });
    expect(await collectionDeps().payments.settling(id)).toEqual([]);
  });
});

describe("charges", () => {
  it("add to the debt with a reason and can be voided", async () => {
    const ids = await seedNoteFixtures();
    await confirmedNote(ids);
    const campaignId = (await collectionLookups(testDb).campaignOn("2026-10-26"))!.id;
    const { id } = await recordCharge(collectionDeps(), admin, {
      customerId: ids.customerId,
      campaignId,
      chargeDate: "2026-11-02",
      amount: "120.50",
      reason: "Interés por mora acordado",
    });
    expect(await balances(ids.customerId)).toEqual({ "2026-10-01": "2320.50" });

    await voidCharge(collectionDeps(), admin, id, { reason: "Se condonó el interés" });
    expect(await balances(ids.customerId)).toEqual({ "2026-10-01": "2200.00" });
  });
});

describe("the day's exchange rate", () => {
  it("is recorded by administration and read by whoever writes notes", async () => {
    await setDailyRate(collectionDeps(), admin, { rateDate: "2026-11-02", rate: "6,97" });
    await setDailyRate(collectionDeps(), admin, { rateDate: "2026-11-02", rate: "6.96" });
    expect(await dailyRate(collectionDeps(), technician, "2026-11-02")).toBe("6.9600");
    expect(await dailyRate(collectionDeps(), technician, "2026-11-03")).toBeNull();
    await expect(
      setDailyRate(collectionDeps(), technician, { rateDate: "2026-11-02", rate: "7" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      dailyRate(collectionDeps(), actorWithRole("warehouse_keeper"), "2026-11-02"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
