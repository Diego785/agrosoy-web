import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { StatementSources } from "@/modules/migration/presentation/statement-preview";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Vista previa con planillas" };

export default function StatementPreviewsPage() {
  return (
    <>
      <PageHeader
        title="Vista previa con planillas"
        description="Estados de cuenta armados con las planillas importadas, para compararlos con el sistema."
      />
      <Suspense>
        <RequirePermission permission="statements.view">
          <StatementSources />
        </RequirePermission>
      </Suspense>
    </>
  );
}
