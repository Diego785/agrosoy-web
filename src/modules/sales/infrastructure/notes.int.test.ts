import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { testDb } from "@test/test-database";
import { createCampaign } from "@/modules/campaigns/application/campaign-use-cases";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { createProduct } from "@/modules/catalog/application/catalog-use-cases";
import { drizzleProductRepository } from "@/modules/catalog/infrastructure/drizzle-catalog-repositories";
import { addCustomerProperty, registerCustomer } from "@/modules/customers/application/customer-use-cases";
import { drizzleCustomerRepository } from "@/modules/customers/infrastructure/drizzle-customer-repository";
import { drizzleZoneRepository } from "@/modules/customers/infrastructure/drizzle-zone-repository";
import { identityTechnicianLookup } from "@/modules/customers/infrastructure/identity-technician-lookup";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import {
  createDraftNote,
  discardDraftNote,
  getNote,
  listNotes,
  updateDraftNote,
} from "../application/note-use-cases";
import { drizzleNoteRepository } from "./drizzle-note-repository";
import { noteLookups } from "./note-lookups";

const admin = actorWithRole("admin");
const audit = () => drizzleAuditTrail(testDb);
const deps = () => ({ notes: drizzleNoteRepository(testDb), lookups: noteLookups(testDb), audit: audit() });

async function setup() {
  await createCampaign({ campaigns: drizzleCampaignRepository(testDb), audit: audit() }, admin, {
    season: "summer",
    year: 2026,
    startsOn: "2026-10-01",
    endsOn: "2027-03-31",
  });
  const customerDeps = {
    customers: drizzleCustomerRepository(testDb),
    zones: drizzleZoneRepository(testDb),
    technicians: identityTechnicianLookup(testDb),
    audit: audit(),
  };
  const { id: customerId } = await registerCustomer(customerDeps, admin, {
    name: "Roberto Mamani",
    exchangeRateKind: "daily",
  });
  const { id: otherId } = await registerCustomer(customerDeps, admin, {
    name: "Tito Cruz",
    exchangeRateKind: "daily",
  });
  const { id: propertyId } = await addCustomerProperty(customerDeps, admin, customerId, {
    name: "El Carmen",
  });
  const { id: foreignPropertyId } = await addCustomerProperty(customerDeps, admin, otherId, {
    name: "La Loma",
  });
  const catalog = { products: drizzleProductRepository(testDb), audit: audit() };
  await createProduct(catalog, admin, {
    name: "Fulvin 40-22",
    line: "fertilizers",
    presentations: [{ content: "20", unit: "l", saleUnit: "measure" }],
  });
  await createProduct(catalog, admin, {
    name: "4-energy",
    line: "agrochemicals",
    presentations: [{ content: "250", unit: "ml", saleUnit: "container" }],
  });
  const products = await drizzleProductRepository(testDb).search({ text: "" });
  const presentationOf = (name: string) =>
    products.find((product) => product.name === name)!.presentations[0]!.id;
  return {
    customerId,
    propertyId,
    foreignPropertyId,
    fulvin: presentationOf("Fulvin 40-22"),
    energy: presentationOf("4-energy"),
  };
}

function draft(ids: Awaited<ReturnType<typeof setup>>, overrides: object = {}) {
  return {
    noteDate: "2026-10-26",
    customerId: ids.customerId,
    propertyId: ids.propertyId,
    paymentTerms: "credit",
    exchangeRate: "6,96",
    receiverName: "Juan Mamani",
    receiverRelationship: "Hijo",
    lines: [
      { presentationId: ids.fulvin, quantity: "200", unitPrice: "11", freeOfCharge: "" },
      { presentationId: ids.energy, quantity: "2", unitPrice: "", freeOfCharge: "sample" },
    ],
    ...overrides,
  };
}

describe("draft delivery notes", () => {
  it("saves a draft with its campaign, lines and totals", async () => {
    const ids = await setup();
    const { id } = await createDraftNote(deps(), actorWithRole("sales_technician"), draft(ids));

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

  it("replaces the lines when a draft is edited, and can discard it", async () => {
    const ids = await setup();
    const { id } = await createDraftNote(deps(), admin, draft(ids));
    await updateDraftNote(
      deps(),
      admin,
      id,
      draft(ids, {
        lines: [{ presentationId: ids.energy, quantity: "12", unitPrice: "62.5", freeOfCharge: "" }],
      }),
    );
    expect((await getNote(deps(), admin, id)).lines.map((line) => line.total)).toEqual(["750.00"]);

    await discardDraftNote(deps(), admin, id);
    await expect(getNote(deps(), admin, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("checks the date's campaign, the property's owner and the prices", async () => {
    const ids = await setup();
    await expect(
      createDraftNote(
        deps(),
        admin,
        draft(ids, {
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
        draft(ids, { noteDate: "2026-09-30", propertyId: ids.foreignPropertyId }),
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { noteDate: [expect.any(String)], propertyId: [expect.any(String)] } },
    });
  });

  it("lets warehouse keepers read notes but not write them", async () => {
    const ids = await setup();
    await expect(
      createDraftNote(deps(), actorWithRole("warehouse_keeper"), draft(ids)),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
