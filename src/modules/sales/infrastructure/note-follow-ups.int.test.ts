import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { draftInput, noteDeps, seedNoteFixtures, type NoteFixtures } from "@test/note-fixtures";
import { testDb } from "@test/test-database";
import { createCampaign } from "@/modules/campaigns/application/campaign-use-cases";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { customerStatement } from "@/modules/receivables/application/statement-use-cases";
import { drizzleStatementReader } from "@/modules/receivables/infrastructure/drizzle-statement-reader";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { followUpOptions, registerReturn, registerTransfer } from "../application/note-follow-ups";
import { confirmNote, voidNote } from "../application/note-lifecycle";
import { createDraftNote, getNote } from "../application/note-use-cases";

const admin = actorWithRole("admin");
const technician = actorWithRole("sales_technician");
const statementDeps = { statements: drizzleStatementReader(testDb), today: () => "2026-11-05" };

/** A confirmed credit note: 200 L of Fulvin at US$ 11 and two free samples. */
async function delivered(ids: NoteFixtures, noteDate = "2026-10-26") {
  const { id } = await createDraftNote(noteDeps(), technician, draftInput(ids, { noteDate }));
  await confirmNote(noteDeps(), technician, id, { paperNumber: "" });
  return id;
}

async function lineIds(noteId: string) {
  const note = await getNote(noteDeps(), admin, noteId);
  return { fulvin: note.lines[0]!.id, sample: note.lines[1]!.id };
}

async function balances(customerId: string) {
  const statement = await customerStatement(statementDeps, admin, customerId, {});
  return Object.fromEntries((statement.byCampaign ?? []).map((row) => [row.season, row.totals.balance]));
}

const returnInput = (lines: { originalLineId: string; quantity: string }[], overrides: object = {}) => ({
  noteDate: "2026-11-02",
  receiverName: "Juan Mamani",
  paperNumber: "",
  lines,
  ...overrides,
});

describe("returns", () => {
  it("work on a note whose rate was left for the payment, and stay without one (D35)", async () => {
    const ids = await seedNoteFixtures();
    const { id: noteId } = await createDraftNote(
      noteDeps(),
      technician,
      draftInput(ids, { exchangeRate: "", rateAtPayment: true }),
    );
    await confirmNote(noteDeps(), technician, noteId, { paperNumber: "" });
    const lines = await lineIds(noteId);

    const { id } = await registerReturn(
      noteDeps(),
      technician,
      noteId,
      returnInput([{ originalLineId: lines.fulvin, quantity: "50" }]),
    );

    expect((await getNote(noteDeps(), admin, id)).exchangeRate).toBeNull();
    expect(await balances(ids.customerId)).toEqual({ summer: "1650.00" });
  });

  it("credit the delivered price in the note's campaign and lower what is left", async () => {
    const ids = await seedNoteFixtures();
    const noteId = await delivered(ids);
    const lines = await lineIds(noteId);

    const { number } = await registerReturn(
      noteDeps(),
      technician,
      noteId,
      returnInput([
        { originalLineId: lines.fulvin, quantity: "50" },
        { originalLineId: lines.sample, quantity: "1" },
      ]),
    );
    expect(number).toBe(2);
    expect(await balances(ids.customerId)).toEqual({ summer: "1650.00" });
    expect((await followUpOptions(noteDeps(), technician, noteId)).remaining).toEqual({
      [lines.fulvin]: "150.000",
      [lines.sample]: "1.000",
    });

    const statement = await customerStatement(statementDeps, admin, ids.customerId, {});
    expect(statement.totals).toMatchObject({ delivered: "2200.00", returned: "550.00", balance: "1650.00" });
    expect(
      statement.lines.filter((line) => line.kind === "return").map((line) => [line.description, line.amount]),
    ).toEqual([
      ["Fulvin 40-22", "550.00"],
      ["4-energy", "0.00"],
    ]);
  });

  it("refuse more than is left, nothing at all, or a date before the delivery", async () => {
    const ids = await seedNoteFixtures();
    const noteId = await delivered(ids);
    const lines = await lineIds(noteId);
    await registerReturn(
      noteDeps(),
      admin,
      noteId,
      returnInput([{ originalLineId: lines.fulvin, quantity: "150" }]),
    );

    await expect(
      registerReturn(
        noteDeps(),
        admin,
        noteId,
        returnInput([{ originalLineId: lines.fulvin, quantity: "50.5" }]),
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { "lines.0.quantity": ["Es más de lo que queda de esta línea."] } },
    });
    await expect(
      registerReturn(
        noteDeps(),
        admin,
        noteId,
        returnInput([{ originalLineId: lines.fulvin, quantity: "" }]),
      ),
    ).rejects.toMatchObject({ details: { fieldErrors: { root: [expect.any(String)] } } });
    await expect(
      registerReturn(
        noteDeps(),
        admin,
        noteId,
        returnInput([{ originalLineId: lines.fulvin, quantity: "1" }], { noteDate: "2026-10-20" }),
      ),
    ).rejects.toMatchObject({
      details: { fieldErrors: { noteDate: ["La fecha es anterior a la entrega."] } },
    });
    await expect(
      registerReturn(
        noteDeps(),
        actorWithRole("warehouse_keeper"),
        noteId,
        returnInput([{ originalLineId: lines.fulvin, quantity: "1" }]),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("must be voided before the delivery note they belong to", async () => {
    const ids = await seedNoteFixtures();
    const noteId = await delivered(ids);
    const lines = await lineIds(noteId);
    const { id: returnId } = await registerReturn(
      noteDeps(),
      admin,
      noteId,
      returnInput([{ originalLineId: lines.fulvin, quantity: "50" }]),
    );

    await expect(voidNote(noteDeps(), admin, noteId, { reason: "Error de carga" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await voidNote(noteDeps(), admin, returnId, { reason: "Devolución mal cargada" });
    expect((await followUpOptions(noteDeps(), admin, noteId)).remaining[lines.fulvin]).toBe("200.000");
    await voidNote(noteDeps(), admin, noteId, { reason: "Error de carga" });
    expect(await balances(ids.customerId)).toEqual({ summer: "0.00" });
  });
});

describe("campaign transfers", () => {
  async function withWinterDelivery() {
    const ids = await seedNoteFixtures();
    await createCampaign(
      { campaigns: drizzleCampaignRepository(testDb), audit: drizzleAuditTrail(testDb) },
      admin,
      { season: "winter", year: 2026, startsOn: "2026-04-01", endsOn: "2026-09-30" },
    );
    const noteId = await delivered(ids, "2026-05-10");
    return { ids, noteId, lines: await lineIds(noteId) };
  }

  const transferInput = (lines: object[], overrides: object = {}) => ({
    noteDate: "2026-11-02",
    exchangeRate: "6.96",
    paperNumber: "",
    lines,
    ...overrides,
  });

  it("credit the old campaign at the old price and charge the new one at the new price", async () => {
    const { ids, noteId, lines } = await withWinterDelivery();
    await registerTransfer(
      noteDeps(),
      technician,
      noteId,
      transferInput([{ originalLineId: lines.fulvin, quantity: "100", unitPrice: "12.5" }]),
    );

    expect(await balances(ids.customerId)).toEqual({ winter: "1100.00", summer: "1250.00" });
    expect((await followUpOptions(noteDeps(), admin, noteId)).remaining[lines.fulvin]).toBe("100.000");
    const statement = await customerStatement(statementDeps, admin, ids.customerId, {});
    expect(
      statement.lines.filter((line) => line.transfer).map((line) => [line.transfer, line.amount]),
    ).toEqual([
      ["out", "-1100.00"],
      ["in", "1250.00"],
    ]);
  });

  it("need a date in another campaign, a price, and leave free products out", async () => {
    const { noteId, lines } = await withWinterDelivery();
    await expect(
      registerTransfer(
        noteDeps(),
        admin,
        noteId,
        transferInput([{ originalLineId: lines.fulvin, quantity: "1", unitPrice: "12" }], {
          noteDate: "2026-06-01",
        }),
      ),
    ).rejects.toMatchObject({ details: { fieldErrors: { noteDate: [expect.any(String)] } } });
    await expect(
      registerTransfer(
        noteDeps(),
        admin,
        noteId,
        transferInput([{ originalLineId: lines.fulvin, quantity: "1", unitPrice: "" }]),
      ),
    ).rejects.toMatchObject({ details: { fieldErrors: { "lines.0.unitPrice": [expect.any(String)] } } });
    await expect(
      registerTransfer(
        noteDeps(),
        admin,
        noteId,
        transferInput([{ originalLineId: lines.sample, quantity: "1", unitPrice: "3" }]),
      ),
    ).rejects.toMatchObject({
      details: { fieldErrors: { root: ["Las bonificaciones y muestras no se pasan de campaña."] } },
    });
  });
});
