import { PlusIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NEW_USER_PATH, PERMISSIONS_PATH } from "@/modules/identity/presentation/identity-routes";
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
              <div className="flex gap-2">
                <Link href={PERMISSIONS_PATH} className={buttonVariants({ variant: "outline" })}>
                  <ShieldCheckIcon aria-hidden />
                  Permisos
                </Link>
                <Link href={NEW_USER_PATH} className={buttonVariants()}>
                  <PlusIcon aria-hidden />
                  Crear usuario
                </Link>
              </div>
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
