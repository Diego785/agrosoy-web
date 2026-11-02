import type { Metadata } from "next";
import { Suspense } from "react";
import { NewProduct, NewProductSkeleton } from "@/modules/catalog/presentation/catalog-pages";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Crear producto" };

export default function NewProductPage() {
  return (
    <>
      <PageHeader
        back={{ href: "/products", label: "Productos" }}
        title="Crear producto"
        description="Cada presentación lleva el código de Agrosoil. Se propone el siguiente número libre y puedes cambiarlo."
      />
      <Suspense fallback={<NewProductSkeleton />}>
        <RequirePermission permission="catalog.manage">
          <NewProduct />
        </RequirePermission>
      </Suspense>
    </>
  );
}
