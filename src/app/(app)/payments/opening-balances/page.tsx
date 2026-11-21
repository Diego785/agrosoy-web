import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  NEW_OPENING_BALANCE_PATH,
  PAYMENTS_PATH,
} from "@/modules/collections/presentation/collection-routes";
import {
  OpeningBalancesTable,
  OpeningBalancesTableSkeleton,
} from "@/modules/collections/presentation/opening-balance-pages";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";
import { buttonVariants } from "@/shared/presentation/ui/button";

export const metadata: Metadata = { title: "Saldos iniciales" };

export default function OpeningBalancesPage({ searchParams }: PageProps<"/payments/opening-balances">) {
  return (
    <>
      <PageHeader
        back={{ href: PAYMENTS_PATH, label: "Cobros" }}
        title="Saldos iniciales"
        description="Lo que cada cliente debía en una campaña cuando empezó el sistema, sin el detalle de boletas y pagos."
        actions={
          <Suspense>
            <RequirePermission permission="payments.manage" fallback={null}>
              <Link href={NEW_OPENING_BALANCE_PATH} className={buttonVariants()}>
                <PlusIcon aria-hidden />
                Registrar saldo inicial
              </Link>
            </RequirePermission>
          </Suspense>
        }
      />
      <Suspense fallback={<OpeningBalancesTableSkeleton />}>
        <RequirePermission permission="payments.manage">
          <OpeningBalancesTable searchParams={searchParams} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
