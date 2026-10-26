import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { CustomerStatementPreview } from "@/modules/migration/presentation/statement-preview";
import { PrintButton } from "@/modules/receivables/presentation/print-button";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Estado de cuenta del cliente" };

export default function CustomerStatementPage({ params }: PageProps<"/statements/[batchId]/[customerKey]">) {
  return (
    <>
      <PageHeader title="Estado de cuenta" actions={<PrintButton />} />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/60" />}>
        <RequirePermission permission="statements.view">
          <CustomerStatementPreview params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
