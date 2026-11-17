import type { Metadata } from "next";
import { Suspense } from "react";
import { CUSTOMERS_PATH } from "@/modules/customers/presentation/customer-routes";
import { ReassignCustomers, ReassignCustomersSkeleton } from "@/modules/customers/presentation/reassign-page";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Cambiar técnico" };

export default function ReassignCustomersPage() {
  return (
    <>
      <PageHeader
        back={{ href: CUSTOMERS_PATH, label: "Clientes" }}
        title="Cambiar técnico"
        description="Pasa varios clientes a otro técnico de una vez, por ejemplo al empezar una campaña."
      />
      <Suspense fallback={<ReassignCustomersSkeleton />}>
        <RequirePermission permission="customers.manage">
          <ReassignCustomers />
        </RequirePermission>
      </Suspense>
    </>
  );
}
