import type { Metadata } from "next";
import { Suspense } from "react";
import { PAYMENTS_PATH } from "@/modules/collections/presentation/collection-routes";
import { InterestPanel, InterestPanelSkeleton } from "@/modules/collections/presentation/interest-pages";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Intereses por mora" };

export default function InterestPage() {
  return (
    <>
      <PageHeader
        back={{ href: PAYMENTS_PATH, label: "Cobros" }}
        title="Intereses por mora"
        description="Cuando vence una campaña, el sistema propone el interés de quien todavía debe; tú decides a quién se carga."
      />
      <Suspense fallback={<InterestPanelSkeleton />}>
        <RequirePermission permission="payments.manage">
          <InterestPanel />
        </RequirePermission>
      </Suspense>
    </>
  );
}
