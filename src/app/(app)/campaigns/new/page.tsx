import type { Metadata } from "next";
import { Suspense } from "react";
import { CampaignForm } from "@/modules/campaigns/presentation/campaign-form";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Crear campaña" };

export default function NewCampaignPage() {
  return (
    <>
      <PageHeader title="Crear campaña" description="Las fechas de dos campañas no pueden cruzarse." />
      <Suspense>
        <RequirePermission permission="catalog.manage">
          <CampaignForm />
        </RequirePermission>
      </Suspense>
    </>
  );
}
