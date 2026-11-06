import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import {
  ReconciliationPage,
  ReconciliationPageSkeleton,
} from "@/modules/migration/presentation/reconciliation-page";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Conciliación con la planilla" };

export default function Page({ params }: PageProps<"/imports/[batchId]/reconciliation">) {
  return (
    <>
      <PageHeader back={{ href: "/imports", label: "Planillas" }} title="Conciliación con la planilla" />
      <Suspense fallback={<ReconciliationPageSkeleton />}>
        <RequirePermission permission="imports.manage">
          <ReconciliationPage params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
