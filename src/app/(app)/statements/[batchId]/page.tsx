import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import {
  PortfolioStatementPreview,
  PortfolioStatementPreviewSkeleton,
} from "@/modules/migration/presentation/statement-preview";
import { PrintButton } from "@/modules/receivables/presentation/print-button";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Estado de cuenta" };

export default function PortfolioStatementPage({ params }: PageProps<"/statements/[batchId]">) {
  return (
    <>
      <PageHeader
        back={{ href: "/statements", label: "Estados de cuenta" }}
        title="Estado de cuenta"
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
