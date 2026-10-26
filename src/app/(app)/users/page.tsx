import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NEW_USER_PATH } from "@/modules/identity/presentation/identity-routes";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { UsersTable, UsersTableSkeleton } from "@/modules/identity/presentation/users-table";
import { PageHeader } from "@/shared/presentation/app-shell";
import { buttonVariants } from "@/shared/presentation/ui/button";

export const metadata: Metadata = { title: "Usuarios" };

export default function UsersPage() {
  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Cada persona ingresa con su propio usuario."
        actions={
          <Suspense>
            <RequirePermission permission="users.manage" fallback={null}>
              <Link href={NEW_USER_PATH} className={buttonVariants()}>
                Crear usuario
              </Link>
            </RequirePermission>
          </Suspense>
        }
      />
      <Suspense fallback={<UsersTableSkeleton />}>
        <RequirePermission permission="users.manage">
          <UsersTable />
        </RequirePermission>
      </Suspense>
    </>
  );
}
