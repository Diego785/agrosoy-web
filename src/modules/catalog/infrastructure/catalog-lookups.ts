import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { drizzleZoneRepository } from "@/modules/customers/infrastructure/drizzle-zone-repository";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import type { CatalogLookups } from "../application/catalog-ports";

/** Campaigns and zones belong to other modules; they are read through those modules' repositories. */
export function catalogLookups(executor: DbExecutor): CatalogLookups {
  return {
    async campaignExists(id) {
      return (await drizzleCampaignRepository(executor).findById(id)) !== undefined;
    },
    zoneExists(id) {
      return drizzleZoneRepository(executor).exists(id);
    },
  };
}
