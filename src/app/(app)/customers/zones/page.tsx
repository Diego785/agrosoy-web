import type { Metadata } from "next";
import { Suspense } from "react";
import { ZonesList } from "@/modules/customers/presentation/zones-list";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Zonas" };

export default function ZonesPage() {
  return (
    <>
      <PageHeader title="Zonas" description="Zonas de venta para agrupar a los clientes." />
      <Suspense>
        <RequirePermission permission="customers.view">
          <ZonesList />
        </RequirePermission>
      </Suspense>
    </>
  );
}
