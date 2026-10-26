import type { Metadata } from "next";
import { Suspense } from "react";
import { NewCustomer } from "@/modules/customers/presentation/edit-customer";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Registrar cliente" };

export default function NewCustomerPage() {
  return (
    <>
      <PageHeader title="Registrar cliente" description="El código se asigna automáticamente." />
      <Suspense>
        <RequirePermission permission="customers.manage">
          <NewCustomer />
        </RequirePermission>
      </Suspense>
    </>
  );
}
