import type { Metadata } from "next";
import { Suspense } from "react";
import { NewCharge } from "@/modules/collections/presentation/collection-pages";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Registrar cargo" };

export default function NewChargePage() {
  return (
    <>
      <PageHeader title="Registrar cargo" />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/60" />}>
        <RequirePermission permission="payments.manage">
          <NewCharge />
        </RequirePermission>
      </Suspense>
    </>
  );
}
