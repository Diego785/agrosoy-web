import type { Metadata } from "next";
import { Suspense } from "react";
import { NewProductForm } from "@/modules/catalog/presentation/product-forms";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Crear producto" };

export default function NewProductPage() {
  return (
    <>
      <PageHeader title="Crear producto" description="El código se asigna automáticamente." />
      <Suspense>
        <RequirePermission permission="catalog.manage">
          <NewProductForm />
        </RequirePermission>
      </Suspense>
    </>
  );
}
