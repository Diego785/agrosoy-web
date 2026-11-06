import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import {
  PortfolioStatementPreview,
  PortfolioStatementPreviewSkeleton,
} from "@/modules/migration/presentation/statement-preview";
import { PrintButton } from "@/modules/receivables/presentation/print-button";
import { STATEMENT_PREVIEWS_PATH } from "@/modules/receivables/presentation/statement-routes";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Estado de cuenta" };

export default function PortfolioStatementPage({ params }: PageProps<"/statements/preview/[batchId]">) {
  return (
    <>
      <PageHeader
        back={{ href: STATEMENT_PREVIEWS_PATH, label: "Vista previa con planillas" }}
        title="Vista previa del estado de cuenta"
        actions={<PrintButton />}
      />
      <Suspense fallback={<PortfolioStatementPreviewSkeleton />}>
        <RequirePermission permission="statements.view">
          <PortfolioStatementPreview params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
