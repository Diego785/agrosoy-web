import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { draftInput, noteDeps, seedNoteFixtures } from "@test/note-fixtures";
import { newUserAccount } from "@/modules/identity/domain/user-account";
import { drizzleUserDirectory } from "@/modules/identity/infrastructure/drizzle-user-directory";
import { testDb } from "@test/test-database";
import {
  createDraftNote,
  discardDraftNote,
  getNote,
  listNotes,
  updateDraftNote,
} from "../application/note-use-cases";

const admin = actorWithRole("admin");
const deps = () => noteDeps();

describe("draft delivery notes", () => {
  it("saves a draft with its campaign, lines and totals", async () => {
    const ids = await seedNoteFixtures();
    const { id } = await createDraftNote(deps(), actorWithRole("sales_technician"), draftInput(ids));

    const note = await getNote(deps(), actorWithRole("warehouse_keeper"), id);
    expect(note).toMatchObject({
      status: "draft",
      number: null,
      noteDate: "2026-10-26",
      customer: { name: "Roberto Mamani" },
      property: { name: "El Carmen" },
      campaign: { season: "summer", year: 2026 },
      exchangeRate: "6.9600",
      receiver: { name: "Juan Mamani", relationship: "Hijo", documentId: null },
    });
    expect(
      note.lines.map((line) => [
        line.productName,
        line.quantity,
        line.unitPrice,
        line.freeOfCharge,
        line.total,
      ]),
    ).toEqual([
      ["Fulvin 40-22", "200.000", "11.00", null, "2200.00"],
      ["4-energy", "2.000", "0.00", "sample", "0.00"],
    ]);
    const { items } = await listNotes(deps(), admin, {});
    expect(items).toMatchObject([{ id, customerName: "Roberto Mamani", total: "2200.00", status: "draft" }]);
  });

  it("lets a credit note leave its rate for the payment, never a cash one (D35)", async () => {
    const ids = await seedNoteFixtures();
    const { id } = await createDraftNote(deps(), admin, draftInput(ids, { exchangeRate: "" }));
    expect((await getNote(deps(), admin, id)).exchangeRate).toBeNull();

    await expect(
      createDraftNote(deps(), admin, draftInput(ids, { exchangeRate: "", paymentTerms: "cash" })),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { exchangeRate: [expect.any(String)] } },
    });
    await expect(
      updateDraftNote(deps(), admin, id, draftInput(ids, { exchangeRate: "", paymentTerms: "cash" })),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createDraftNote(deps(), admin, draftInput(ids, { exchangeRate: "doce" })),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("replaces the lines when a draft is edited, and can discard it", async () => {
    const ids = await seedNoteFixtures();
    const { id } = await createDraftNote(deps(), admin, draftInput(ids));
    await updateDraftNote(
      deps(),
      admin,
      id,
      draftInput(ids, {
        lines: [{ presentationId: ids.energy, quantity: "12", unitPrice: "62.5", freeOfCharge: "" }],
      }),
    );
    expect((await getNote(deps(), admin, id)).lines.map((line) => line.total)).toEqual(["750.00"]);

    await discardDraftNote(deps(), admin, id);
    await expect(getNote(deps(), admin, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("checks the date's campaign, the property's owner and the prices", async () => {
    const ids = await seedNoteFixtures();
    await expect(
      createDraftNote(
        deps(),
        admin,
        draftInput(ids, {
          noteDate: "2026-09-30",
          propertyId: ids.foreignPropertyId,
          lines: [{ presentationId: ids.fulvin, quantity: "1", unitPrice: "", freeOfCharge: "" }],
        }),
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { "lines.0.unitPrice": [expect.any(String)] } },
    });
    await expect(
      createDraftNote(
        deps(),
        admin,
        draftInput(ids, { noteDate: "2026-09-30", propertyId: ids.foreignPropertyId }),
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { noteDate: [expect.any(String)], propertyId: [expect.any(String)] } },
    });
  });

  it("records who hands the product over and the carrier", async () => {
    const ids = await seedNoteFixtures();
    const users = drizzleUserDirectory(testDb);
    const { id: keeperId } = await users.create(
      newUserAccount({
        name: "Mario Rojas",
        username: "mrojas",
        role: "warehouse_keeper",
        position: "Encargado de almacén",
      }),
      "temporary-password",
    );
    const { id } = await createDraftNote(
      deps(),
      admin,
      draftInput(ids, {
        handedOverById: keeperId,
        carrierName: "Transportes Chiquitano",
        carrierVehicle: "Volvo 2345-XYZ",
        carrierDocumentId: "4567890 sc",
      }),
    );
    expect(await getNote(deps(), admin, id)).toMatchObject({
      handedOverBy: { id: keeperId, name: "Mario Rojas", position: "Encargado de almacén" },
      carrier: { name: "Transportes Chiquitano", vehicle: "Volvo 2345-XYZ", documentId: "4567890 SC" },
    });

    const { id: plain } = await createDraftNote(deps(), admin, draftInput(ids));
    expect(await getNote(deps(), admin, plain)).toMatchObject({
      handedOverBy: null,
      carrier: { name: null, vehicle: null, documentId: null },
    });
    await expect(
      createDraftNote(deps(), admin, draftInput(ids, { handedOverById: crypto.randomUUID() })),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { handedOverById: [expect.any(String)] } },
    });
  });

  it("lets warehouse keepers read notes but not write them", async () => {
    const ids = await seedNoteFixtures();
    await expect(
      createDraftNote(deps(), actorWithRole("warehouse_keeper"), draftInput(ids)),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
