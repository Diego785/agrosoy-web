import { cn } from "cn";
import { SproutIcon } from "lucide-react";
import { listCampaigns } from "@/modules/campaigns/application/campaign-use-cases";
import { campaignOn } from "@/modules/campaigns/domain/campaign";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { getDb } from "@/shared/infrastructure/db/client";
import { todayInBolivia } from "@/shared/presentation/business-date";
import { EmptyState } from "@/shared/presentation/empty-state";
import { Loading, Skeleton } from "@/shared/presentation/skeletons";
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

/** The upload card of `ProductListForm` while the campaigns load; the review appears only after it. */
export function ProductListImportSkeleton() {
  return (
    <Loading label="Cargando formulario">
      <div aria-hidden className="flex max-w-2xl flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          {["w-40", "w-36"].map((width) => (
            <div key={width} className="flex flex-col gap-2">
              <Skeleton className={cn("my-0.5 h-3.5", width)} />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 py-0.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
    </Loading>
  );
}
