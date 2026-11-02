import { SproutIcon } from "lucide-react";
import { listCampaigns } from "@/modules/campaigns/application/campaign-use-cases";
import { campaignOn } from "@/modules/campaigns/domain/campaign";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { getDb } from "@/shared/infrastructure/db/client";
import { todayInBolivia } from "@/shared/presentation/business-date";
import { EmptyState } from "@/shared/presentation/empty-state";
import { ProductListForm } from "./product-list-form";

/** Agrosoil's product list (PRODUCTOS.xlsx) into the catalog, with its prices for one campaign. */
export async function ProductListImport() {
  const actor = await requireActor();
  const campaigns = await listCampaigns({ campaigns: drizzleCampaignRepository(getDb()) }, actor);
  if (campaigns.length === 0) {
    return (
      <EmptyState icon={<SproutIcon />} title="Sin campañas">
        Primero crea una campaña en Campañas: los precios de la lista son de una campaña.
      </EmptyState>
    );
  }
  const current = campaignOn(campaigns, todayInBolivia()) ?? campaigns[0]!;
  return (
    <ProductListForm
      campaigns={campaigns.map((campaign) => ({ id: campaign.id, label: campaignLabel(campaign) }))}
      defaultCampaignId={current.id}
    />
  );
}
