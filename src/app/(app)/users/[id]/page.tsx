import type { Metadata } from "next";
import { Suspense } from "react";
import { EditUser, EditUserSkeleton } from "@/modules/identity/presentation/edit-user";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Editar usuario" };

export default function EditUserPage({ params }: PageProps<"/users/[id]">) {
  return (
    <>
      <PageHeader back={{ href: "/users", label: "Usuarios" }} title="Editar usuario" />
      <Suspense fallback={<EditUserSkeleton />}>
        <RequirePermission permission="users.manage">
          <EditUser params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
