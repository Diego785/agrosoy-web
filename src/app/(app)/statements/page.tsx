import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { LedgerPortfolio } from "@/modules/receivables/presentation/ledger-statements";
import { PrintButton } from "@/modules/receivables/presentation/print-button";
import { STATEMENT_PREVIEWS_PATH } from "@/modules/receivables/presentation/statement-routes";
import { PageHeader } from "@/shared/presentation/app-shell";
import { buttonVariants } from "@/shared/presentation/ui/button";

export const metadata: Metadata = { title: "Estados de cuenta" };

export default function StatementsPage({ searchParams }: PageProps<"/statements">) {
  return (
    <>
      <PageHeader
        title="Estados de cuenta"
        description="Deuda de cada cliente según las boletas, pagos y cargos registrados."
        actions={
          <div className="flex gap-2 print:hidden">
            <Link href={STATEMENT_PREVIEWS_PATH} className={buttonVariants({ variant: "outline" })}>
              Vista previa con planillas
            </Link>
            <PrintButton />
          </div>
        }
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/60" />}>
        <RequirePermission permission="statements.view">
          <LedgerPortfolio searchParams={searchParams} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
