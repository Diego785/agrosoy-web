import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { listCampaigns } from "@/modules/campaigns/application/campaign-use-cases";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { listProducts, priceSheet } from "@/modules/catalog/application/catalog-use-cases";
import { catalogDeps } from "@/modules/catalog/presentation/catalog-deps";
import { listZones } from "@/modules/customers/application/customer-use-cases";
import {
  authorizedReceivers,
  customerProperties,
  customers,
} from "@/modules/customers/infrastructure/customers.tables";
import { drizzleZoneRepository } from "@/modules/customers/infrastructure/drizzle-zone-repository";
import { identityTechnicianLookup } from "@/modules/customers/infrastructure/identity-technician-lookup";
import type { Actor } from "@/shared/application/actor";
import { assertCan } from "@/shared/application/permissions";
import { getDb } from "@/shared/infrastructure/db/client";

export type NoteFormOptions = Awaited<ReturnType<typeof loadNoteFormOptions>>;

/**
 * Everything the note form needs to work without round trips: active customers with their
 * properties and receivers, presentations, open campaigns and their reference prices.
 */
export async function loadNoteFormOptions(actor: Actor) {
  assertCan(actor, "notes.manage");
  const db = getDb();
  const [customerRows, propertyRows, receiverRows, products, campaigns, zones, technicians] =
    await Promise.all([
      db
        .select({
          id: customers.id,
          code: customers.code,
          name: customers.name,
          zoneId: customers.zoneId,
          technicianId: customers.technicianId,
          fixedExchangeRate: customers.fixedExchangeRate,
        })
        .from(customers)
        .where(eq(customers.isActive, true))
        .orderBy(asc(customers.comparisonName)),
      db
        .select({
          id: customerProperties.id,
          customerId: customerProperties.customerId,
          name: customerProperties.name,
        })
        .from(customerProperties)
        .where(eq(customerProperties.isActive, true)),
      db
        .select({
          id: authorizedReceivers.id,
          customerId: authorizedReceivers.customerId,
          name: authorizedReceivers.name,
          documentId: authorizedReceivers.documentId,
          relationship: authorizedReceivers.relationship,
        })
        .from(authorizedReceivers)
        .where(and(eq(authorizedReceivers.isActive, true))),
      listProducts(catalogDeps(db), actor, { text: "" }),
      listCampaigns({ campaigns: drizzleCampaignRepository(db) }, actor),
      listZones({ zones: drizzleZoneRepository(db) }, actor),
      identityTechnicianLookup(db).listActive(),
    ]);

  const openCampaigns = campaigns.filter((campaign) => campaign.status === "open");
  // Reference prices per campaign, keyed by zone id ("" for the general price) and presentation id.
  const prices: Record<string, Record<string, Record<string, string>>> = {};
  for (const campaign of openCampaigns) {
    prices[campaign.id] = {};
    for (const zoneId of ["", ...zones.map((zone) => zone.id)]) {
      const sheet = await priceSheet(catalogDeps(db), actor, { campaignId: campaign.id, zoneId });
      prices[campaign.id]![zoneId] = Object.fromEntries(
        sheet.flatMap((row) => (row.price ? [[row.presentation.id, row.price]] : [])),
      );
    }
  }

  return {
    customers: customerRows.map((customer) => ({
      ...customer,
      properties: propertyRows.filter((property) => property.customerId === customer.id),
      receivers: receiverRows.filter((receiver) => receiver.customerId === customer.id),
    })),
    presentations: products.flatMap((product) =>
      product.presentations.map((presentation) => ({ ...presentation, productName: product.name })),
    ),
    campaigns: openCampaigns,
    technicians,
    prices,
  };
}
