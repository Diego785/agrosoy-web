import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { ConversionPage, ConversionPageSkeleton } from "@/modules/migration/presentation/conversion-page";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Pasar al sistema" };

export default function ConvertImportPage({ params }: PageProps<"/imports/[batchId]/convert">) {
  return (
    <>
      <PageHeader
        back={{ href: "/imports", label: "Planillas" }}
        title="Pasar clientes y productos al sistema"
      />
      <Suspense fallback={<ConversionPageSkeleton />}>
        <RequirePermission permission="imports.manage">
          <ConversionPage params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
