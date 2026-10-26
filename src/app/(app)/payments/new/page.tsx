import type { Metadata } from "next";
import { Suspense } from "react";
import { NewPayment } from "@/modules/collections/presentation/collection-pages";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Registrar pago" };

export default function NewPaymentPage({ searchParams }: PageProps<"/payments/new">) {
  return (
    <>
      <PageHeader title="Registrar pago" />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/60" />}>
        <RequirePermission permission="payments.manage">
          <NewPayment searchParams={searchParams} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
