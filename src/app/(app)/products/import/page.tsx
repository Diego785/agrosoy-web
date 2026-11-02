import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { ProductListImport } from "@/modules/migration/presentation/product-list-page";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Importar lista de productos" };

export default function ImportProductsPage() {
  return (
    <>
      <PageHeader
        back={{ href: "/products", label: "Productos" }}
        title="Importar lista de productos"
        description="La lista de Agrosoil con sus códigos y precios en dólares (PRODUCTOS.xlsx)."
      />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-muted/60" />}>
        <RequirePermission permission="catalog.manage">
          <ProductListImport />
        </RequirePermission>
      </Suspense>
    </>
  );
}
