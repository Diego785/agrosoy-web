import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { draftInput, noteDeps, seedNoteFixtures, type NoteFixtures } from "@test/note-fixtures";
import { testDb } from "@test/test-database";
import { ledgerEntries } from "@/modules/receivables/infrastructure/ledger.tables";
import { confirmNote, nextNoteNumber, setNextNoteNumber, voidNote } from "../application/note-lifecycle";
import { createDraftNote, getNote } from "../application/note-use-cases";

const admin = actorWithRole("admin");
const technician = actorWithRole("sales_technician");

async function draft(ids: NoteFixtures, overrides: object = {}) {
  const { id } = await createDraftNote(noteDeps(), technician, draftInput(ids, overrides));
  return id;
}

async function ledger() {
  const rows = await testDb.select().from(ledgerEntries).orderBy(ledgerEntries.createdAt);
  return rows.map((row) => ({
    kind: row.kind,
    date: row.entryDate,
    amount: row.amount,
    reverses: !!row.reversesEntryId,
  }));
}

describe("confirming delivery notes", () => {
  it("gives the next number and charges the debt on the note's date", async () => {
    const ids = await seedNoteFixtures();
    await setNextNoteNumber(noteDeps(), admin, { nextNumber: "1250" });
    const first = await draft(ids);
    const second = await draft(ids);

    expect(await confirmNote(noteDeps(), technician, first, { paperNumber: "" })).toEqual({
      number: 1250,
      receiptNumber: null,
    });
    expect(await confirmNote(noteDeps(), technician, second, { paperNumber: "" })).toEqual({
      number: 1251,
      receiptNumber: null,
    });

    expect(await getNote(noteDeps(), admin, first)).toMatchObject({
      status: "confirmed",
      number: 1250,
      confirmed: { byName: null },
    });
    expect(await ledger()).toEqual([
      { kind: "delivery", date: "2026-10-26", amount: "2200.00", reverses: false },
      { kind: "delivery", date: "2026-10-26", amount: "2200.00", reverses: false },
    ]);
    await expect(confirmNote(noteDeps(), technician, first, { paperNumber: "" })).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
  });

  it("keeps the printed number of paper notes and skips it when numbering reaches it", async () => {
    const ids = await seedNoteFixtures();
    await confirmNote(noteDeps(), technician, await draft(ids), { paperNumber: "2" });
    await expect(
      confirmNote(noteDeps(), technician, await draft(ids), { paperNumber: "2" }),
    ).rejects.toMatchObject({ code: "DUPLICATE", details: { field: "paperNumber" } });

    expect(await nextNoteNumber(noteDeps(), technician)).toBe(1);
    await confirmNote(noteDeps(), technician, await draft(ids), { paperNumber: "" });
    expect(await nextNoteNumber(noteDeps(), technician)).toBe(3);
  });

  it("charges the same debt when the rate is left for the payment (D35)", async () => {
    const ids = await seedNoteFixtures();
    const id = await draft(ids, { exchangeRate: "" });
    await confirmNote(noteDeps(), technician, id, { paperNumber: "" });

    expect(await getNote(noteDeps(), admin, id)).toMatchObject({ status: "confirmed", exchangeRate: null });
    expect(await ledger()).toEqual([
      { kind: "delivery", date: "2026-10-26", amount: "2200.00", reverses: false },
    ]);
  });

  it("charges nothing for a note with only bonus or sample lines", async () => {
    const ids = await seedNoteFixtures();
    const id = await draft(ids, {
      lines: [{ presentationId: ids.energy, quantity: "3", unitPrice: "", freeOfCharge: "bonus" }],
    });
    await confirmNote(noteDeps(), technician, id, { paperNumber: "" });
    expect(await ledger()).toEqual([]);
  });

  it("asks how a cash note was paid", async () => {
    const ids = await seedNoteFixtures();
    const id = await draft(ids, { paymentTerms: "cash" });
    await expect(confirmNote(noteDeps(), technician, id, { paperNumber: "" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("does not let warehouse keepers confirm", async () => {
    const ids = await seedNoteFixtures();
    const id = await draft(ids);
    await expect(
      confirmNote(noteDeps(), actorWithRole("warehouse_keeper"), id, { paperNumber: "" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("voiding delivery notes", () => {
  it("keeps the note and cancels its debt on the day of the void", async () => {
    const ids = await seedNoteFixtures();
    const id = await draft(ids);
    await confirmNote(noteDeps(), technician, id, { paperNumber: "" });

    await expect(
      voidNote(noteDeps(), technician, id, { reason: "Cliente no recibió" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(voidNote(noteDeps(), admin, id, { reason: "no" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await voidNote(noteDeps("2026-11-05"), admin, id, { reason: "Cliente no recibió el producto" });

    expect(await getNote(noteDeps(), admin, id)).toMatchObject({
      status: "voided",
      number: 1,
      voided: { reason: "Cliente no recibió el producto" },
    });
    expect(await ledger()).toEqual([
      { kind: "delivery", date: "2026-10-26", amount: "2200.00", reverses: false },
      { kind: "delivery", date: "2026-11-05", amount: "-2200.00", reverses: true },
    ]);
    await expect(voidNote(noteDeps(), admin, id, { reason: "Otra vez por error" })).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
  });

  it("only voids confirmed notes", async () => {
    const ids = await seedNoteFixtures();
    const id = await draft(ids);
    await expect(voidNote(noteDeps(), admin, id, { reason: "Era un borrador" })).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
  });
});

describe("the ledger", () => {
  it("cannot be edited or deleted, only appended to", async () => {
    const ids = await seedNoteFixtures();
    await confirmNote(noteDeps(), technician, await draft(ids), { paperNumber: "" });
    await expect(testDb.execute(sql`update ledger_entries set amount = 1`)).rejects.toThrow();
    await expect(testDb.execute(sql`delete from ledger_entries`)).rejects.toThrow();
  });
});

describe("note numbering", () => {
  it("lets administration continue from a pad but not reuse a number", async () => {
    const ids = await seedNoteFixtures();
    await confirmNote(noteDeps(), technician, await draft(ids), { paperNumber: "40" });
    await expect(setNextNoteNumber(noteDeps(), admin, { nextNumber: "40" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(setNextNoteNumber(noteDeps(), technician, { nextNumber: "41" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await setNextNoteNumber(noteDeps(), admin, { nextNumber: "41" });
    expect(await nextNoteNumber(noteDeps(), technician)).toBe(41);
  });
});
