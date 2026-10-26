import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentDetail } from "@/modules/collections/presentation/collection-pages";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Recibo" };

export default function PaymentPage({ params }: PageProps<"/payments/[id]">) {
  return (
    <>
      <PageHeader title="Recibo de pago" />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/60" />}>
        <RequirePermission permission="payments.manage">
          <PaymentDetail params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
