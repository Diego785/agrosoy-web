import { PercentIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  DailyRateCard,
  PaymentsPageSkeleton,
  PaymentsTable,
} from "@/modules/collections/presentation/collection-pages";
import { CHARGES_PATH, NEW_PAYMENT_PATH } from "@/modules/collections/presentation/collection-routes";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";
import { buttonVariants } from "@/shared/presentation/ui/button";

export const metadata: Metadata = { title: "Cobros" };

export default function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  return (
    <>
      <PageHeader
        title="Cobros"
        description="Pagos recibidos de los clientes, cada uno con su recibo."
        actions={
          <Suspense>
            <RequirePermission permission="payments.manage" fallback={null}>
              <div className="flex gap-2">
                <Link href={CHARGES_PATH} className={buttonVariants({ variant: "outline" })}>
                  <PercentIcon aria-hidden />
                  Cargos
                </Link>
                <Link href={NEW_PAYMENT_PATH} className={buttonVariants()}>
                  <PlusIcon aria-hidden />
                  Registrar pago
                </Link>
              </div>
            </RequirePermission>
          </Suspense>
        }
      />
      <Suspense fallback={<PaymentsPageSkeleton />}>
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
