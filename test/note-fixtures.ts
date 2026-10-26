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
import { drizzleLedgerRepository } from "@/modules/receivables/infrastructure/drizzle-ledger-repository";
import { drizzleNoteRepository } from "@/modules/sales/infrastructure/drizzle-note-repository";
import { noteLookups } from "@/modules/sales/infrastructure/note-lookups";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { drizzleDocumentCounter } from "@/shared/infrastructure/db/document-counters";

const admin = actorWithRole("admin");
const audit = () => drizzleAuditTrail(testDb);

/** Everything the sales use cases need, against the test database. */
export function noteDeps(today = "2026-11-02") {
  return {
    notes: drizzleNoteRepository(testDb),
    lookups: noteLookups(testDb),
    numbering: drizzleDocumentCounter(testDb, "delivery_note"),
    ledger: drizzleLedgerRepository(testDb),
    audit: audit(),
    today: () => today,
  };
}

/** Summer 2026, two customers (one with a property each) and two products. */
export async function seedNoteFixtures() {
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
    otherId,
    propertyId,
    foreignPropertyId,
    fulvin: presentationOf("Fulvin 40-22"),
    energy: presentationOf("4-energy"),
  };
}

export type NoteFixtures = Awaited<ReturnType<typeof seedNoteFixtures>>;

/** A credit note for Roberto: 200 L of Fulvin at US$ 11 (US$ 2.200) and two free samples. */
export function draftInput(ids: NoteFixtures, overrides: object = {}) {
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
