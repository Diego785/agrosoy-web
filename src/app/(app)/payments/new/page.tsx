import type { Metadata } from "next";
import { Suspense } from "react";
import { NewPayment, PaymentFormSkeleton } from "@/modules/collections/presentation/collection-pages";
import { PAYMENTS_PATH } from "@/modules/collections/presentation/collection-routes";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Registrar pago" };

export default function NewPaymentPage({ searchParams }: PageProps<"/payments/new">) {
  return (
    <>
      <PageHeader back={{ href: PAYMENTS_PATH, label: "Cobros" }} title="Registrar pago" />
      <Suspense fallback={<PaymentFormSkeleton />}>
        <RequirePermission permission="payments.manage">
          <NewPayment searchParams={searchParams} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
