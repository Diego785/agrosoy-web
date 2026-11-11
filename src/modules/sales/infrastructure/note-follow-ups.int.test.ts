import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { draftInput, noteDeps, seedNoteFixtures, type NoteFixtures } from "@test/note-fixtures";
import { testDb } from "@test/test-database";
import { createCampaign } from "@/modules/campaigns/application/campaign-use-cases";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { customerStatement } from "@/modules/receivables/application/statement-use-cases";
import { drizzleStatementReader } from "@/modules/receivables/infrastructure/drizzle-statement-reader";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import {
  followUpOptions,
  listFollowUps,
  registerReturn,
  registerTransfer,
} from "../application/note-follow-ups";
import { confirmNote, voidNote } from "../application/note-lifecycle";
import { createDraftNote, getNote } from "../application/note-use-cases";

const admin = actorWithRole("admin");
const technician = actorWithRole("sales_technician");
const statementDeps = { statements: drizzleStatementReader(testDb), today: () => "2026-11-05" };

/** A confirmed credit note: 200 L of Fulvin at US$ 11 and two free samples. */
async function delivered(ids: NoteFixtures, noteDate = "2026-10-26", overrides: object = {}) {
  const { id } = await createDraftNote(noteDeps(), technician, draftInput(ids, { noteDate, ...overrides }));
  await confirmNote(noteDeps(), technician, id, { paperNumber: "" });
  return id;
}

/** The note's lines and campaign, and whose product it is. */
async function noteParts(noteId: string) {
  const note = await getNote(noteDeps(), admin, noteId);
  return {
    target: { customerId: note.customer.id, campaignId: note.campaign.id },
    fulvin: note.lines[0]!.id,
    sample: note.lines[1]!.id,
  };
}

/** What is left of each line the customer holds from the campaign, by line id. */
async function remainingOf(target: { customerId: string; campaignId: string }) {
  const lines = await followUpOptions(noteDeps(), admin, target);
  return Object.fromEntries(
    lines.map((line) => [line.id, line.quantity.subtract(line.settled).toDecimalString()]),
  );
}

async function balances(customerId: string) {
  const statement = await customerStatement(statementDeps, admin, customerId, {});
  return Object.fromEntries((statement.byCampaign ?? []).map((row) => [row.season, row.totals.balance]));
}

const returnInput = (
  target: { customerId: string; campaignId: string },
  lines: { originalLineId: string; quantity: string }[],
  overrides: object = {},
) => ({
  ...target,
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
    const { target, fulvin } = await noteParts(noteId);

    const { id } = await registerReturn(
      noteDeps(),
      technician,
      returnInput(target, [{ originalLineId: fulvin, quantity: "50" }]),
    );

    expect((await getNote(noteDeps(), admin, id)).exchangeRate).toBeNull();
    expect(await balances(ids.customerId)).toEqual({ summer: "1650.00" });
  });

  it("credit the delivered price in the note's campaign and lower what is left", async () => {
    const ids = await seedNoteFixtures();
    const noteId = await delivered(ids);
    const { target, fulvin, sample } = await noteParts(noteId);

    const { number } = await registerReturn(
      noteDeps(),
      technician,
      returnInput(target, [
        { originalLineId: fulvin, quantity: "50" },
        { originalLineId: sample, quantity: "1" },
      ]),
    );
    expect(number).toBe(2);
    expect(await balances(ids.customerId)).toEqual({ summer: "1650.00" });
    expect(await remainingOf(target)).toEqual({ [fulvin]: "150.000", [sample]: "1.000" });

    const statement = await customerStatement(statementDeps, admin, ids.customerId, {});
    expect(statement.totals).toMatchObject({ delivered: "2200.00", returned: "550.00", balance: "1650.00" });
    expect(
      statement.lines.filter((line) => line.kind === "return").map((line) => [line.description, line.amount]),
    ).toEqual([
      ["Fulvin 40-22", "550.00"],
      ["4-energy", "0.00"],
    ]);
  });

  it("gather lines from several deliveries of the customer in the campaign, each at its own price (D25)", async () => {
    const ids = await seedNoteFixtures();
    const first = await delivered(ids, "2026-10-26");
    const second = await delivered(ids, "2026-10-30", {
      lines: [{ presentationId: ids.fulvin, quantity: "100", unitPrice: "10", freeOfCharge: "" }],
    });
    const { target, fulvin: firstFulvin } = await noteParts(first);
    const secondFulvin = (await getNote(noteDeps(), admin, second)).lines[0]!.id;

    const { id } = await registerReturn(
      noteDeps(),
      technician,
      returnInput(target, [
        { originalLineId: firstFulvin, quantity: "50" },
        { originalLineId: secondFulvin, quantity: "30" },
      ]),
    );

    // 50 × 11 + 30 × 10 off the 3.200 delivered.
    expect(await balances(ids.customerId)).toEqual({ summer: "2350.00" });
    const note = await getNote(noteDeps(), admin, id);
    expect(note.sources.map((source) => [source.id, source.number])).toEqual([
      [first, 1],
      [second, 2],
    ]);
    expect(note.lines.map((line) => line.sourceNoteId)).toEqual([first, second]);
    // Both deliveries went to the same property with the same technician, so the return says so.
    const delivery = await getNote(noteDeps(), admin, first);
    expect([note.property?.name, note.technician?.id]).toEqual(["El Carmen", delivery.technician?.id]);
    for (const noteId of [first, second]) {
      expect((await listFollowUps(noteDeps(), admin, noteId)).map((followUp) => followUp.id)).toEqual([id]);
    }
    expect((await remainingOf(target))[secondFulvin]).toBe("70.000");
  });

  it("refuse more than is left, nothing at all, another customer's line or a date before the delivery", async () => {
    const ids = await seedNoteFixtures();
    const noteId = await delivered(ids);
    const { target, fulvin } = await noteParts(noteId);
    await registerReturn(
      noteDeps(),
      admin,
      returnInput(target, [{ originalLineId: fulvin, quantity: "150" }]),
    );

    await expect(
      registerReturn(noteDeps(), admin, returnInput(target, [{ originalLineId: fulvin, quantity: "50.5" }])),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { "lines.0.quantity": ["Es más de lo que queda de esta línea."] } },
    });
    await expect(
      registerReturn(noteDeps(), admin, returnInput(target, [{ originalLineId: fulvin, quantity: "" }])),
    ).rejects.toMatchObject({ details: { fieldErrors: { root: [expect.any(String)] } } });
    await expect(
      registerReturn(
        noteDeps(),
        admin,
        returnInput({ ...target, customerId: ids.otherId }, [{ originalLineId: fulvin, quantity: "1" }]),
      ),
    ).rejects.toMatchObject({
      details: {
        fieldErrors: { "lines.0.quantity": ["Esa línea no es de lo que el cliente recibió en la campaña."] },
      },
    });
    await expect(
      registerReturn(
        noteDeps(),
        admin,
        returnInput(target, [{ originalLineId: fulvin, quantity: "1" }], { noteDate: "2026-10-20" }),
      ),
    ).rejects.toMatchObject({
      details: { fieldErrors: { noteDate: ["La fecha es anterior a la boleta N.º 1 del 26/10/2026."] } },
    });
    await expect(
      registerReturn(
        noteDeps(),
        actorWithRole("warehouse_keeper"),
        returnInput(target, [{ originalLineId: fulvin, quantity: "1" }]),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("must be voided before the delivery note they belong to", async () => {
    const ids = await seedNoteFixtures();
    const noteId = await delivered(ids);
    const { target, fulvin } = await noteParts(noteId);
    const { id: returnId } = await registerReturn(
      noteDeps(),
      admin,
      returnInput(target, [{ originalLineId: fulvin, quantity: "50" }]),
    );

    await expect(voidNote(noteDeps(), admin, noteId, { reason: "Error de carga" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await voidNote(noteDeps(), admin, returnId, { reason: "Devolución mal cargada" });
    expect((await remainingOf(target))[fulvin]).toBe("200.000");
    await voidNote(noteDeps(), admin, noteId, { reason: "Error de carga" });
    expect(await balances(ids.customerId)).toEqual({ summer: "0.00" });
    expect(await followUpOptions(noteDeps(), admin, target)).toEqual([]);
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
    return { ids, noteId, ...(await noteParts(noteId)) };
  }

  const transferInput = (
    target: { customerId: string; campaignId: string },
    lines: object[],
    overrides: object = {},
  ) => ({
    ...target,
    noteDate: "2026-11-02",
    exchangeRate: "6.96",
    paperNumber: "",
    lines,
    ...overrides,
  });

  it("credit the old campaign at the old price and charge the new one at the new price", async () => {
    const { ids, target, fulvin } = await withWinterDelivery();
    await registerTransfer(
      noteDeps(),
      technician,
      transferInput(target, [{ originalLineId: fulvin, quantity: "100", unitPrice: "12.5" }]),
    );

    expect(await balances(ids.customerId)).toEqual({ winter: "1100.00", summer: "1250.00" });
    expect((await remainingOf(target))[fulvin]).toBe("100.000");
    const statement = await customerStatement(statementDeps, admin, ids.customerId, {});
    expect(
      statement.lines.filter((line) => line.transfer).map((line) => [line.transfer, line.amount]),
    ).toEqual([
      ["out", "-1100.00"],
      ["in", "1250.00"],
    ]);
  });

  it("bring product into the new campaign, where it can come back at the new price (D25)", async () => {
    const { ids, target, fulvin } = await withWinterDelivery();
    const { id: transferId } = await registerTransfer(
      noteDeps(),
      technician,
      transferInput(target, [{ originalLineId: fulvin, quantity: "100", unitPrice: "12.5" }]),
    );
    const summer = {
      customerId: ids.customerId,
      campaignId: (await getNote(noteDeps(), admin, transferId)).campaign.id,
    };
    const [moved] = await followUpOptions(noteDeps(), admin, summer);
    expect(moved && [moved.source.id, moved.unitPrice.toDecimalString()]).toEqual([transferId, "12.50"]);

    await registerReturn(
      noteDeps(),
      technician,
      returnInput(summer, [{ originalLineId: moved!.id, quantity: "40" }], { noteDate: "2026-11-04" }),
    );
    expect(await balances(ids.customerId)).toEqual({ winter: "1100.00", summer: "750.00" });
    // The transfer now has a return behind it, so it can't be voided first.
    await expect(voidNote(noteDeps(), admin, transferId, { reason: "Error" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("need a date in another campaign, a price, and leave free products out", async () => {
    const { target, fulvin, sample } = await withWinterDelivery();
    await expect(
      registerTransfer(
        noteDeps(),
        admin,
        transferInput(target, [{ originalLineId: fulvin, quantity: "1", unitPrice: "12" }], {
          noteDate: "2026-06-01",
        }),
      ),
    ).rejects.toMatchObject({ details: { fieldErrors: { noteDate: [expect.any(String)] } } });
    await expect(
      registerTransfer(
        noteDeps(),
        admin,
        transferInput(target, [{ originalLineId: fulvin, quantity: "1", unitPrice: "" }]),
      ),
    ).rejects.toMatchObject({ details: { fieldErrors: { "lines.0.unitPrice": [expect.any(String)] } } });
    await expect(
      registerTransfer(
        noteDeps(),
        admin,
        transferInput(target, [{ originalLineId: sample, quantity: "1", unitPrice: "3" }]),
      ),
    ).rejects.toMatchObject({
      details: { fieldErrors: { root: ["Las bonificaciones y muestras no se pasan de campaña."] } },
    });
  });
});
