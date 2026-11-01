import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductsTable } from "@/modules/catalog/presentation/catalog-pages";
import {
  IMPORT_PRODUCTS_PATH,
  NEW_PRODUCT_PATH,
  PRICES_PATH,
} from "@/modules/catalog/presentation/catalog-routes";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";
import { buttonVariants } from "@/shared/presentation/ui/button";

export const metadata: Metadata = { title: "Productos" };

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <>
      <PageHeader
        title="Productos"
        description="Catálogo con sus presentaciones y la línea de cada producto."
        actions={
          <Suspense>
            <div className="flex flex-wrap gap-2">
              <Link href={PRICES_PATH} className={buttonVariants({ variant: "outline" })}>
                Precios
              </Link>
              <RequirePermission permission="catalog.manage" fallback={null}>
                <Link href={IMPORT_PRODUCTS_PATH} className={buttonVariants({ variant: "outline" })}>
                  Importar lista
                </Link>
                <Link href={NEW_PRODUCT_PATH} className={buttonVariants()}>
                  Crear producto
                </Link>
              </RequirePermission>
            </div>
          </Suspense>
        }
      />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-muted/60" />}>
        <RequirePermission permission="catalog.view">
          <ProductsTable searchParams={searchParams} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
