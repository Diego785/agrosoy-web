import type { Metadata } from "next";
import { Suspense } from "react";
import { EditCustomer } from "@/modules/customers/presentation/edit-customer";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Editar cliente" };

export default function EditCustomerPage({ params }: PageProps<"/customers/[id]">) {
  return (
    <>
      <PageHeader title="Editar cliente" />
      <Suspense>
        <RequirePermission permission="customers.manage">
          <EditCustomer params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
