import { and, eq, inArray } from "drizzle-orm";
import { campaignOn } from "@/modules/campaigns/domain/campaign";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { presentations } from "@/modules/catalog/infrastructure/catalog.tables";
import { customerProperties, customers } from "@/modules/customers/infrastructure/customers.tables";
import { identityTechnicianLookup } from "@/modules/customers/infrastructure/identity-technician-lookup";
import { drizzleUserDirectory } from "@/modules/identity/infrastructure/drizzle-user-directory";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import type { NoteLookups } from "../application/note-ports";

/** Reads what a note refers to in the customers, campaigns, identity and catalog modules. */
export function noteLookups(executor: DbExecutor): NoteLookups {
  return {
    async customer(id) {
      const [customer] = await executor
        .select({ isActive: customers.isActive })
        .from(customers)
        .where(eq(customers.id, id));
      if (!customer) return undefined;
      const properties = await executor
        .select({ id: customerProperties.id })
        .from(customerProperties)
        .where(and(eq(customerProperties.customerId, id), eq(customerProperties.isActive, true)));
      return { isActive: customer.isActive, propertyIds: properties.map((property) => property.id) };
    },

    async campaignOn(isoDate) {
      const campaign = campaignOn(await drizzleCampaignRepository(executor).list(), isoDate);
      return campaign ? { id: campaign.id, status: campaign.status } : undefined;
    },

    isActiveTechnician(id) {
      return identityTechnicianLookup(executor).isActiveTechnician(id);
    },

    async isActiveUser(id) {
      return (await drizzleUserDirectory(executor).findById(id))?.active === true;
    },

    async activePresentations(ids) {
      if (ids.length === 0) return new Set();
      const rows = await executor
        .select({ id: presentations.id })
        .from(presentations)
        .where(and(inArray(presentations.id, ids), eq(presentations.isActive, true)));
      return new Set(rows.map((row) => row.id));
    },
  };
}
