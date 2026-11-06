import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { ImportBatches, ImportBatchesSkeleton } from "@/modules/migration/presentation/import-batches";
import { ImportForm } from "@/modules/migration/presentation/import-form";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Importar planillas" };

export default function ImportsPage() {
  return (
    <>
      <PageHeader
        title="Importar planillas"
        description="Planillas de ventas de los técnicos, para revisarlas y ver su estado de cuenta."
      />
      <Suspense fallback={<ImportBatchesSkeleton />}>
        <RequirePermission permission="imports.manage">
          <ImportForm />
          <ImportBatches />
        </RequirePermission>
      </Suspense>
    </>
  );
}
