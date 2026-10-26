import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DailyRateCard, PaymentsTable } from "@/modules/collections/presentation/collection-pages";
import { CHARGES_PATH, NEW_PAYMENT_PATH } from "@/modules/collections/presentation/collection-routes";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";
import { buttonVariants } from "@/shared/presentation/ui/button";

export const metadata: Metadata = { title: "Cobranzas" };

export default function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  return (
    <>
      <PageHeader
        title="Cobranzas"
        description="Pagos recibidos de los clientes. Cada pago tiene su recibo y baja la deuda."
        actions={
          <Suspense>
            <RequirePermission permission="payments.manage" fallback={null}>
              <div className="flex gap-2">
                <Link href={CHARGES_PATH} className={buttonVariants({ variant: "outline" })}>
                  Cargos
                </Link>
                <Link href={NEW_PAYMENT_PATH} className={buttonVariants()}>
                  Registrar pago
                </Link>
              </div>
            </RequirePermission>
          </Suspense>
        }
      />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-muted/60" />}>
        <RequirePermission permission="payments.manage">
          <div className="flex flex-col gap-6">
            <DailyRateCard />
            <PaymentsTable searchParams={searchParams} />
          </div>
        </RequirePermission>
      </Suspense>
    </>
  );
}
