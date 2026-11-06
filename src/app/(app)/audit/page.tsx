import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditLogTable, AuditLogTableSkeleton } from "@/modules/identity/presentation/audit-log-table";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Registro de cambios" };

export default function AuditPage({ searchParams }: PageProps<"/audit">) {
  return (
    <>
      <PageHeader title="Registro de cambios" description="Quién hizo cada cambio y cuándo." />
      <Suspense fallback={<AuditLogTableSkeleton />}>
        <RequirePermission permission="audit.view">
          <AuditLogTable searchParams={searchParams} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
