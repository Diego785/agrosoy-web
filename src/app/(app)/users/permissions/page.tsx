import type { Metadata } from "next";
import { Suspense } from "react";
import {
  PermissionMatrix,
  PermissionMatrixSkeleton,
} from "@/modules/identity/presentation/permission-matrix";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Permisos" };

export default function PermissionsPage() {
  return (
    <>
      <PageHeader
        back={{ href: "/users", label: "Usuarios" }}
        title="Permisos"
        description="Qué puede hacer cada rol en el sistema."
      />
      <Suspense fallback={<PermissionMatrixSkeleton />}>
        <RequirePermission permission="users.manage">
          <PermissionMatrix />
        </RequirePermission>
      </Suspense>
    </>
  );
}
