import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChargesTable, ChargesTableSkeleton } from "@/modules/collections/presentation/collection-pages";
import { NEW_CHARGE_PATH, PAYMENTS_PATH } from "@/modules/collections/presentation/collection-routes";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";
import { buttonVariants } from "@/shared/presentation/ui/button";

export const metadata: Metadata = { title: "Cargos" };

export default function ChargesPage({ searchParams }: PageProps<"/payments/charges">) {
  return (
    <>
      <PageHeader
        back={{ href: PAYMENTS_PATH, label: "Cobros" }}
        title="Cargos"
        description="Intereses y otros montos que se suman a la deuda de un cliente, siempre con su motivo."
        actions={
          <Suspense>
            <RequirePermission permission="payments.manage" fallback={null}>
              <Link href={NEW_CHARGE_PATH} className={buttonVariants()}>
                <PlusIcon aria-hidden />
                Registrar cargo
              </Link>
            </RequirePermission>
          </Suspense>
        }
      />
      <Suspense fallback={<ChargesTableSkeleton />}>
        <RequirePermission permission="payments.manage">
          <ChargesTable searchParams={searchParams} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
