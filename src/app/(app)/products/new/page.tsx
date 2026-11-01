import type { Metadata } from "next";
import { Suspense } from "react";
import { NewProductForm } from "@/modules/catalog/presentation/product-forms";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Crear producto" };

export default function NewProductPage() {
  return (
    <>
      <PageHeader
        title="Crear producto"
        description="Cada presentación lleva el código de Agrosoy; si lo dejas vacío, toma el siguiente número libre."
      />
      <Suspense>
        <RequirePermission permission="catalog.manage">
          <NewProductForm />
        </RequirePermission>
      </Suspense>
    </>
  );
}
