import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { LedgerCustomerStatement } from "@/modules/receivables/presentation/ledger-statements";
import { PrintButton } from "@/modules/receivables/presentation/print-button";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Estado de cuenta del cliente" };

export default function CustomerStatementPage({
  params,
  searchParams,
}: PageProps<"/statements/[customerId]">) {
  return (
    <>
      <PageHeader title="Estado de cuenta" actions={<PrintButton />} />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/60" />}>
        <RequirePermission permission="statements.view">
          <LedgerCustomerStatement params={params} searchParams={searchParams} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
