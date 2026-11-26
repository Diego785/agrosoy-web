import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { IMPORTS_PATH } from "@/modules/migration/presentation/migration-routes";
import {
  SheetEntriesPage,
  SheetEntriesPageSkeleton,
} from "@/modules/migration/presentation/sheet-entries-page";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Pagos y devoluciones de la planilla" };

export default function Page({ params }: PageProps<"/imports/[batchId]/reconciliation/[customerId]">) {
  return (
    <>
      <PageHeader
        back={{ href: IMPORTS_PATH, label: "Planillas" }}
        title="Pagos y devoluciones de la planilla"
      />
      <Suspense fallback={<SheetEntriesPageSkeleton />}>
        <RequirePermission permission="imports.manage">
          <SheetEntriesPage params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
