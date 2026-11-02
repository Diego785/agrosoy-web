import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomerFormSkeleton, EditCustomer } from "@/modules/customers/presentation/edit-customer";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Editar cliente" };

export default function EditCustomerPage({ params }: PageProps<"/customers/[id]/edit">) {
  return (
    <>
      <PageHeader back={{ href: "/customers", label: "Clientes" }} title="Editar cliente" />
      <Suspense fallback={<CustomerFormSkeleton editing />}>
        <RequirePermission permission="customers.manage">
          <EditCustomer params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
