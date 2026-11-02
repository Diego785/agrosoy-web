import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CampaignsTable } from "@/modules/campaigns/presentation/campaign-pages";
import { NEW_CAMPAIGN_PATH } from "@/modules/campaigns/presentation/campaign-routes";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";
import { buttonVariants } from "@/shared/presentation/ui/button";

export const metadata: Metadata = { title: "Campañas" };

export default function CampaignsPage() {
  return (
    <>
      <PageHeader
        title="Campañas"
        description="Temporadas de verano e invierno, cada una con sus precios."
        actions={
          <Suspense>
            <RequirePermission permission="catalog.manage" fallback={null}>
              <Link href={NEW_CAMPAIGN_PATH} className={buttonVariants()}>
                <PlusIcon aria-hidden />
                Crear campaña
              </Link>
            </RequirePermission>
          </Suspense>
        }
      />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-muted/60" />}>
        <RequirePermission permission="catalog.view">
          <CampaignsTable />
        </RequirePermission>
      </Suspense>
    </>
  );
}
