import { notFound } from "next/navigation";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { listCampaigns } from "@/modules/campaigns/application/campaign-use-cases";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { normalizeForComparison } from "@/shared/domain/text";
import { todayInBolivia } from "@/shared/presentation/business-date";
import { conversionPreview } from "../application/conversion";
import { conversionDeps } from "../infrastructure/conversion-adapters";
import { CustomerConversion, ProductConversion } from "./conversion-forms";
import { SalesConversion } from "./sales-conversion-forms";

export async function ConversionPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const actor = await requireActor();
  const preview = await conversionPreview(conversionDeps(getDb(), actor), actor, batchId).catch(
    (error: unknown) => {
      if (isDomainError(error) && (error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED"))
        notFound();
      throw error;
    },
  );

  const campaigns = (await listCampaigns({ campaigns: drizzleCampaignRepository(getDb()) }, actor)).map(
    (campaign) => ({ id: campaign.id, label: campaignLabel(campaign) }),
  );
  // The sheet's title ("CAMPAÑA INVIERNO 2026") names its campaign.
  const title = normalizeForComparison(preview.batch.campaignLabel ?? "");
  const suggested = campaigns.find((campaign) => title.includes(normalizeForComparison(campaign.label)));
  const conversion = preview.batch.salesConversion;

  return (
    <div className="flex max-w-5xl flex-col gap-10">
      <p className="text-sm text-muted-foreground">
        Hoja «{preview.batch.sheetName}» · {preview.batch.campaignLabel ?? "sin campaña"}. Se crean registros
        reales del sistema; la planilla importada no cambia.
      </p>
      <CustomerConversion preview={preview} />
      <ProductConversion preview={preview} />
      <SalesConversion
        batchId={preview.batch.id}
        campaigns={campaigns}
        suggestedCampaignId={suggested?.id ?? null}
        defaultCutoffDate={todayInBolivia()}
        conversion={
          conversion
            ? {
                campaignLabel:
                  campaigns.find((campaign) => campaign.id === conversion.campaignId)?.label ?? "",
                cutoffDate: conversion.cutoffDate,
                at: conversion.at,
              }
            : null
        }
      />
    </div>
  );
}
