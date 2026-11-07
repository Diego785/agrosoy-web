import type { Metadata } from "next";
import { Suspense } from "react";
import { ChargeFormSkeleton, NewCharge } from "@/modules/collections/presentation/collection-pages";
import { CHARGES_PATH } from "@/modules/collections/presentation/collection-routes";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Registrar cargo" };

export default function NewChargePage() {
  return (
    <>
      <PageHeader back={{ href: CHARGES_PATH, label: "Cargos" }} title="Registrar cargo" />
      <Suspense fallback={<ChargeFormSkeleton />}>
        <RequirePermission permission="payments.manage">
          <NewCharge />
        </RequirePermission>
      </Suspense>
    </>
  );
}
