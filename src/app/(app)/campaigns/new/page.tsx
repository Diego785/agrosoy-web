import type { Metadata } from "next";
import { Suspense } from "react";
import { CampaignForm } from "@/modules/campaigns/presentation/campaign-form";
import { CampaignFormSkeleton } from "@/modules/campaigns/presentation/campaign-pages";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Crear campaña" };

export default function NewCampaignPage() {
  return (
    <>
      <PageHeader
        back={{ href: "/campaigns", label: "Campañas" }}
        title="Crear campaña"
        description="Las fechas de dos campañas no pueden cruzarse."
      />
      <Suspense fallback={<CampaignFormSkeleton />}>
        <RequirePermission permission="catalog.manage">
          <CampaignForm />
        </RequirePermission>
      </Suspense>
    </>
  );
}
