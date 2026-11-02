import type { Metadata } from "next";
import { Suspense } from "react";
import { ZonesList, ZonesListSkeleton } from "@/modules/customers/presentation/zones-list";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Zonas" };

export default function ZonesPage() {
  return (
    <>
      <PageHeader
        back={{ href: "/customers", label: "Clientes" }}
        title="Zonas"
        description="Zonas de venta para agrupar a los clientes."
      />
      <Suspense fallback={<ZonesListSkeleton />}>
        <RequirePermission permission="customers.view">
          <ZonesList />
        </RequirePermission>
      </Suspense>
    </>
  );
}
