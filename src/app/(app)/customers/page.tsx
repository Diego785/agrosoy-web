import { MapPinIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NEW_CUSTOMER_PATH, ZONES_PATH } from "@/modules/customers/presentation/customer-routes";
import { CustomersTable, CustomersTableSkeleton } from "@/modules/customers/presentation/customers-table";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";
import { buttonVariants } from "@/shared/presentation/ui/button";

export const metadata: Metadata = { title: "Clientes" };

export default function CustomersPage({ searchParams }: PageProps<"/customers">) {
  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cartera de clientes de todas las zonas."
        actions={
          <Suspense>
            <RequirePermission permission="customers.manage" fallback={null}>
              <div className="flex gap-2">
                <Link href={ZONES_PATH} className={buttonVariants({ variant: "outline" })}>
                  <MapPinIcon aria-hidden />
                  Zonas
                </Link>
                <Link href={NEW_CUSTOMER_PATH} className={buttonVariants()}>
                  <PlusIcon aria-hidden />
                  Registrar cliente
                </Link>
              </div>
            </RequirePermission>
          </Suspense>
        }
      />
      <Suspense fallback={<CustomersTableSkeleton />}>
        <RequirePermission permission="customers.view">
          <CustomersTable searchParams={searchParams} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
