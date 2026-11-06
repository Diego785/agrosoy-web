import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import {
  LedgerCustomerStatement,
  LedgerCustomerStatementSkeleton,
} from "@/modules/receivables/presentation/ledger-statements";
import { PrintButton } from "@/modules/receivables/presentation/print-button";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Estado de cuenta del cliente" };

export default function CustomerStatementPage({
  params,
  searchParams,
}: PageProps<"/statements/[customerId]">) {
  return (
    <>
      <PageHeader
        back={{ href: "/statements", label: "Estados de cuenta" }}
        title="Estado de cuenta"
        actions={<PrintButton />}
      />
      <Suspense fallback={<LedgerCustomerStatementSkeleton />}>
        <RequirePermission permission="statements.view">
          <LedgerCustomerStatement params={params} searchParams={searchParams} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
