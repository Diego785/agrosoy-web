import type { Metadata } from "next";
import { Suspense } from "react";
import { OPENING_BALANCES_PATH } from "@/modules/collections/presentation/collection-routes";
import {
  NewOpeningBalance,
  OpeningBalanceFormSkeleton,
} from "@/modules/collections/presentation/opening-balance-pages";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Registrar saldo inicial" };

export default function NewOpeningBalancePage() {
  return (
    <>
      <PageHeader
        back={{ href: OPENING_BALANCES_PATH, label: "Saldos iniciales" }}
        title="Registrar saldo inicial"
      />
      <Suspense fallback={<OpeningBalanceFormSkeleton />}>
        <RequirePermission permission="payments.manage">
          <NewOpeningBalance />
        </RequirePermission>
      </Suspense>
    </>
  );
}
