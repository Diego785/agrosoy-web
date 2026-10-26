import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChargesTable } from "@/modules/collections/presentation/collection-pages";
import { NEW_CHARGE_PATH } from "@/modules/collections/presentation/collection-routes";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";
import { buttonVariants } from "@/shared/presentation/ui/button";

export const metadata: Metadata = { title: "Cargos" };

export default function ChargesPage({ searchParams }: PageProps<"/payments/charges">) {
  return (
    <>
      <PageHeader
        title="Cargos"
        description="Montos que se suman a la deuda de un cliente, por ejemplo intereses, siempre con su motivo."
        actions={
          <Suspense>
            <RequirePermission permission="payments.manage" fallback={null}>
              <Link href={NEW_CHARGE_PATH} className={buttonVariants()}>
                Registrar cargo
              </Link>
            </RequirePermission>
          </Suspense>
        }
      />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-muted/60" />}>
        <RequirePermission permission="payments.manage">
          <ChargesTable searchParams={searchParams} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
