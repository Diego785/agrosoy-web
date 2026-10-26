import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductDetail } from "@/modules/catalog/presentation/catalog-pages";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Producto" };

export default function ProductPage({ params }: PageProps<"/products/[id]">) {
  return (
    <>
      <PageHeader title="Producto" />
      <Suspense>
        <RequirePermission permission="catalog.view">
          <ProductDetail params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
