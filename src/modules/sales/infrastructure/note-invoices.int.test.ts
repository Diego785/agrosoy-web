import { asc, eq, like } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { draftInput, noteDeps, seedNoteFixtures, type NoteFixtures } from "@test/note-fixtures";
import { testDb } from "@test/test-database";
import { customerStatement } from "@/modules/receivables/application/statement-use-cases";
import { drizzleStatementReader } from "@/modules/receivables/infrastructure/drizzle-statement-reader";
import { auditLog } from "@/shared/infrastructure/audit/audit-log.table";
import { invoiceCandidates, setNoteInvoice } from "../application/note-invoices";
import { confirmNote, voidNote } from "../application/note-lifecycle";
import { createDraftNote, getNote } from "../application/note-use-cases";

const admin = actorWithRole("admin");
const technician = actorWithRole("sales_technician");

async function draft(ids: NoteFixtures, overrides: object = {}) {
  const { id } = await createDraftNote(noteDeps(), technician, draftInput(ids, overrides));
  return id;
}

async function confirmed(ids: NoteFixtures, overrides: object = {}) {
  const id = await draft(ids, overrides);
  await confirmNote(noteDeps(), technician, id, { paperNumber: "" });
  return id;
}

const invoiceOf = async (id: string) => (await getNote(noteDeps(), admin, id)).taxInvoiceNumber;

async function invoiceLog() {
  const rows = await testDb
    .select({ action: auditLog.action, payload: auditLog.payload })
    .from(auditLog)
    .where(like(auditLog.action, "sales.%_invoice"))
    .orderBy(asc(auditLog.occurredAt));
  return rows.map((row) => [
    row.action,
    (row.payload as { taxInvoiceNumber: string | null }).taxInvoiceNumber,
  ]);
}

describe("invoice numbers on confirmed notes (D40)", () => {
  it("writes one invoice on several deliveries of the same customer and campaign", async () => {
    const ids = await seedNoteFixtures();
    const first = await confirmed(ids, { noteDate: "2026-10-26" });
    const second = await confirmed(ids, { noteDate: "2026-11-01" });
    const untouched = await confirmed(ids, { noteDate: "2026-11-02" });

    expect(
      await setNoteInvoice(noteDeps(), admin, first, { taxInvoiceNumber: " 4471 ", alsoNoteIds: [second] }),
    ).toEqual({ updated: 2 });
    expect([await invoiceOf(first), await invoiceOf(second), await invoiceOf(untouched)]).toEqual([
      "4471",
      "4471",
      null,
    ]);
    expect(await invoiceLog()).toEqual([
      ["sales.set_invoice", "4471"],
      ["sales.set_invoice", "4471"],
    ]);
  });

  it("only logs the notes that change, and clears the number when it is left empty", async () => {
    const ids = await seedNoteFixtures();
    const first = await confirmed(ids);
    const second = await confirmed(ids);
    await setNoteInvoice(noteDeps(), admin, first, { taxInvoiceNumber: "4471" });

    expect(
      await setNoteInvoice(noteDeps(), admin, second, { taxInvoiceNumber: "4471", alsoNoteIds: [first] }),
    ).toEqual({ updated: 1 });
    expect(await setNoteInvoice(noteDeps(), admin, first, { taxInvoiceNumber: "" })).toEqual({ updated: 1 });
    expect([await invoiceOf(first), await invoiceOf(second)]).toEqual([null, "4471"]);
    expect(await invoiceLog()).toEqual([
      ["sales.set_invoice", "4471"],
      ["sales.set_invoice", "4471"],
      ["sales.clear_invoice", null],
    ]);
  });

  it("offers the customer's confirmed deliveries of the campaign, without voided ones", async () => {
    const ids = await seedNoteFixtures();
    const first = await confirmed(ids, { noteDate: "2026-10-26" });
    const voided = await confirmed(ids, { noteDate: "2026-10-27" });
    await voidNote(noteDeps(), admin, voided, { reason: "Se cargó dos veces" });
    await confirmed(ids, { customerId: ids.otherId, propertyId: "" });
    await draft(ids);

    expect(await invoiceCandidates(noteDeps(), admin, first)).toEqual([
      {
        id: first,
        number: 1,
        imported: false,
        noteDate: "2026-10-26",
        total: "2200.00",
        taxInvoiceNumber: null,
      },
    ]);
  });

  it("refuses drafts, other customers' notes and users without the permission", async () => {
    const ids = await seedNoteFixtures();
    const note = await confirmed(ids);
    const others = await confirmed(ids, { customerId: ids.otherId, propertyId: "" });
    const pending = await draft(ids);

    await expect(setNoteInvoice(noteDeps(), admin, pending, { taxInvoiceNumber: "1" })).rejects.toMatchObject(
      {
        code: "INVALID_STATE",
      },
    );
    await expect(
      setNoteInvoice(noteDeps(), admin, note, { taxInvoiceNumber: "1", alsoNoteIds: [others] }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { alsoNoteIds: expect.any(Array) } },
    });
    await expect(
      setNoteInvoice(noteDeps(), technician, note, { taxInvoiceNumber: "1" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await invoiceOf(note)).toBeNull();
  });

  it("shows the invoice beside its note in the statement", async () => {
    const ids = await seedNoteFixtures();
    const note = await confirmed(ids);
    await setNoteInvoice(noteDeps(), admin, note, { taxInvoiceNumber: "4471" });

    const statement = await customerStatement(
      { statements: drizzleStatementReader(testDb), today: () => "2026-11-02" },
      admin,
      ids.customerId,
      {},
    );
    expect(statement.lines.map((line) => [line.description, line.invoiceNumber])).toEqual([
      ["Fulvin 40-22", "4471"],
      ["4-energy", null],
    ]);
    const [row] = await testDb.select().from(auditLog).where(eq(auditLog.action, "sales.set_invoice"));
    expect(row?.payload).toMatchObject({ number: 1, taxInvoiceNumber: "4471", previous: null });
  });
});
