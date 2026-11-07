import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentDetail, PaymentDetailSkeleton } from "@/modules/collections/presentation/collection-pages";
import { PAYMENTS_PATH } from "@/modules/collections/presentation/collection-routes";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Recibo" };

export default function PaymentPage({ params }: PageProps<"/payments/[id]">) {
  return (
    <>
      <PageHeader back={{ href: PAYMENTS_PATH, label: "Cobros" }} title="Recibo de pago" />
      <Suspense fallback={<PaymentDetailSkeleton />}>
        <RequirePermission permission="payments.manage">
          <PaymentDetail params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
