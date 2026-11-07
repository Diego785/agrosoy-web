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
  currentRate,
  getPayment,
  listCharges,
  listPayments,
  officialRate,
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
      concept: "interest",
      amount: "120.50",
      reason: "Interés por mora acordado",
    });
    expect(await balances(ids.customerId)).toEqual({ "2026-10-01": "2320.50" });

    await voidCharge(collectionDeps(), admin, id, { reason: "Se condonó el interés" });
    expect(await balances(ids.customerId)).toEqual({ "2026-10-01": "2200.00" });
  });
});

describe("the exchange rate in force", () => {
  it("is recorded by administration and read by whoever writes notes", async () => {
    await setDailyRate(collectionDeps(), admin, { rateDate: "2026-11-02", rate: "6,97" });
    await setDailyRate(collectionDeps(), admin, { rateDate: "2026-11-02", rate: "6.96" });
    expect(await currentRate(collectionDeps(), technician, "2026-11-02")).toEqual({
      rate: "6.9600",
      since: "2026-11-02",
    });
    await expect(
      setDailyRate(collectionDeps(), technician, { rateDate: "2026-11-02", rate: "7" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      currentRate(collectionDeps(), actorWithRole("warehouse_keeper"), "2026-11-02"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("stays the last one recorded until another replaces it (D36)", async () => {
    expect(await currentRate(collectionDeps(), technician, "2026-11-02")).toBeNull();

    await setDailyRate(collectionDeps(), admin, { rateDate: "2026-11-02", rate: "12" });
    expect(await currentRate(collectionDeps(), technician, "2026-11-20")).toEqual({
      rate: "12.0000",
      since: "2026-11-02",
    });

    await setDailyRate(collectionDeps(), admin, { rateDate: "2026-11-05", rate: "11.89" });
    expect(await currentRate(collectionDeps(), technician, "2026-11-20")).toMatchObject({ rate: "11.8900" });
    // A later rate doesn't reach back to the days before it.
    expect(await currentRate(collectionDeps(), technician, "2026-11-03")).toMatchObject({ rate: "12.0000" });
    expect(await currentRate(collectionDeps(), technician, "2026-11-01")).toBeNull();
  });

  it("offers the official rate only to whoever records it, and copes without it", async () => {
    const official = { latest: async () => ({ rate: "11.8900", date: "2026-11-06" }) };
    expect(await officialRate({ official }, admin)).toEqual({ rate: "11.8900", date: "2026-11-06" });
    await expect(officialRate({ official }, technician)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await officialRate({ official: { latest: async () => null } }, admin)).toBeNull();
  });
});

describe("lists", () => {
  it("finds payments by customer or receipt and filters by status", async () => {
    const ids = await seedNoteFixtures();
    await confirmedNote(ids);
    const first = await recordPayment(collectionDeps(), admin, payment(ids, { amount: "100" }));
    const second = await recordPayment(collectionDeps(), admin, payment(ids, { amount: "200" }));
    await voidPayment(collectionDeps(), admin, second.id, { reason: "Se registró dos veces" });

    const everything = await listPayments(collectionDeps(), admin, {});
    expect(everything.total).toBe(2);
    expect(everything.pageSize).toBe(20);

    const voided = await listPayments(collectionDeps(), admin, { status: "voided" });
    expect(voided.items.map((item) => item.id)).toEqual([second.id]);

    const byReceipt = await listPayments(collectionDeps(), admin, {
      text: String(first.receiptNumber),
    });
    expect(byReceipt.items.map((item) => item.id)).toContain(first.id);

    const nobody = await listPayments(collectionDeps(), admin, { text: "nadie se llama asi" });
    expect(nobody).toMatchObject({ items: [], total: 0 });
  });

  it("finds charges by customer and filters by status", async () => {
    const ids = await seedNoteFixtures();
    await recordCharge(collectionDeps(), admin, {
      customerId: ids.customerId,
      campaignId: (await collectionLookups(testDb).campaignOn("2026-10-26"))!.id,
      chargeDate: "2026-11-02",
      concept: "interest",
      amount: "50",
      reason: "Interés por mora acordado",
    });

    expect((await listCharges(collectionDeps(), admin, {})).total).toBe(1);
    expect((await listCharges(collectionDeps(), admin, { status: "voided" })).total).toBe(0);
    expect((await listCharges(collectionDeps(), admin, { text: "nadie se llama asi" })).total).toBe(0);
  });
});

describe("receipts", () => {
  it("keep the balances of the moment they were issued (D27)", async () => {
    const ids = await seedNoteFixtures();
    await confirmedNote(ids);
    const { id } = await recordPayment(collectionDeps(), admin, payment(ids, { amount: "200" }));
    await recordPayment(collectionDeps(), admin, payment(ids, { amount: "300" }));

    // Later payments leave the first receipt as it was.
    const first = await getPayment(collectionDeps(), admin, id);
    expect(first.balance).toEqual({ before: "2200.00", after: "2000.00" });
  });

  it("keep the concept administration wrote", async () => {
    const ids = await seedNoteFixtures();
    await confirmedNote(ids);
    const { id } = await recordPayment(
      collectionDeps(),
      admin,
      payment(ids, { amount: "200", concept: "Anticipo de la cosecha" }),
    );
    expect((await getPayment(collectionDeps(), admin, id)).concept).toBe("Anticipo de la cosecha");
  });
});

describe("charge concepts", () => {
  it("lowers the debt with a price adjustment, and a void gives it back (D24)", async () => {
    const ids = await seedNoteFixtures();
    await confirmedNote(ids);
    const campaignId = (await collectionLookups(testDb).campaignOn("2026-10-26"))!.id;
    const { id } = await recordCharge(collectionDeps(), admin, {
      customerId: ids.customerId,
      campaignId,
      chargeDate: "2026-11-02",
      concept: "price_adjustment",
      direction: "credit",
      amount: "200",
      reason: "Precio acordado con gerencia",
    });
    expect(await balances(ids.customerId)).toEqual({ "2026-10-01": "2000.00" });

    await voidCharge(collectionDeps(), admin, id, { reason: "Se registró por error" });
    expect(await balances(ids.customerId)).toEqual({ "2026-10-01": "2200.00" });
  });

  it("rejects lowering the debt with interest", async () => {
    const ids = await seedNoteFixtures();
    const campaignId = (await collectionLookups(testDb).campaignOn("2026-10-26"))!.id;
    await expect(
      recordCharge(collectionDeps(), admin, {
        customerId: ids.customerId,
        campaignId,
        chargeDate: "2026-11-02",
        concept: "interest",
        direction: "credit",
        amount: "50",
        reason: "Interés por mora",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
