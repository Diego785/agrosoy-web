import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PortfolioStatementPreview } from "@/modules/migration/presentation/statement-preview";
import { PrintButton } from "@/modules/receivables/presentation/print-button";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Estado de cuenta" };

export default function PortfolioStatementPage({ params }: PageProps<"/statements/preview/[batchId]">) {
  return (
    <>
      <PageHeader title="Vista previa del estado de cuenta" actions={<PrintButton />} />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/60" />}>
        <RequirePermission permission="statements.view">
          <PortfolioStatementPreview params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
