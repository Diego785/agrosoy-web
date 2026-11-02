import type { Metadata } from "next";
import { Suspense } from "react";
import { CampaignFormSkeleton, EditCampaign } from "@/modules/campaigns/presentation/campaign-pages";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Editar campaña" };

export default function EditCampaignPage({ params }: PageProps<"/campaigns/[id]">) {
  return (
    <>
      <PageHeader back={{ href: "/campaigns", label: "Campañas" }} title="Editar campaña" />
      <Suspense fallback={<CampaignFormSkeleton />}>
        <RequirePermission permission="catalog.manage">
          <EditCampaign params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
