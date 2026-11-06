import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import {
  StatementSources,
  StatementSourcesSkeleton,
} from "@/modules/migration/presentation/statement-preview";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Vista previa con planillas" };

export default function StatementPreviewsPage() {
  return (
    <>
      <PageHeader
        back={{ href: "/statements", label: "Estados de cuenta" }}
        title="Vista previa con planillas"
        description="Estados de cuenta armados con las planillas importadas, para compararlos con el sistema."
      />
      <Suspense fallback={<StatementSourcesSkeleton />}>
        <RequirePermission permission="statements.view">
          <StatementSources />
        </RequirePermission>
      </Suspense>
    </>
  );
}
