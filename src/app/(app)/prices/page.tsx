import type { Metadata } from "next";
import { Suspense } from "react";
import { PriceSheet, PriceSheetSkeleton } from "@/modules/catalog/presentation/catalog-pages";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Precios de referencia" };

export default function PricesPage({ searchParams }: PageProps<"/prices">) {
  return (
    <>
      <PageHeader
        title="Precios de referencia"
        description="En dólares, por campaña y zona. En cada boleta se registra el precio negociado."
      />
      <Suspense fallback={<PriceSheetSkeleton />}>
        <RequirePermission permission="catalog.view">
          <PriceSheet searchParams={searchParams} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
