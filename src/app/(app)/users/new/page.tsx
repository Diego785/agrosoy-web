import type { Metadata } from "next";
import { Suspense } from "react";
import { NewUser } from "@/modules/identity/presentation/edit-user";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Crear usuario" };

export default function NewUserPage() {
  return (
    <>
      <PageHeader title="Crear usuario" description="El sistema genera una contraseña temporal." />
      <Suspense>
        <RequirePermission permission="users.manage">
          <NewUser />
        </RequirePermission>
      </Suspense>
    </>
  );
}
