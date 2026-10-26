import type { Metadata } from "next";
import { Suspense } from "react";
import { PermissionMatrix } from "@/modules/identity/presentation/permission-matrix";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Permisos" };

export default function PermissionsPage() {
  return (
    <>
      <PageHeader title="Permisos" description="Qué puede hacer cada rol en el sistema." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/60" />}>
        <RequirePermission permission="users.manage">
          <PermissionMatrix />
        </RequirePermission>
      </Suspense>
    </>
  );
}
