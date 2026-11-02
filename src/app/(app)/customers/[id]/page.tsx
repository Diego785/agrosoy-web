import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomerDetail, CustomerDetailSkeleton } from "@/modules/customers/presentation/customer-detail";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Cliente" };

export default function CustomerPage({ params }: PageProps<"/customers/[id]">) {
  return (
    <>
      <PageHeader back={{ href: "/customers", label: "Clientes" }} title="Cliente" />
      <Suspense fallback={<CustomerDetailSkeleton />}>
        <RequirePermission permission="customers.view">
          <CustomerDetail params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
