import type { Metadata } from "next";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/modules/identity/presentation/change-password-form";
import { getCurrentUser, requireActor } from "@/modules/identity/presentation/current-user";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Cambiar contraseña" };

export default function ChangePasswordPage() {
  return (
    <>
      <PageHeader title="Cambiar contraseña" />
      <Suspense>
        <PendingChangeNotice />
      </Suspense>
      <ChangePasswordForm />
    </>
  );
}

async function PendingChangeNotice() {
  await requireActor({ allowPendingPasswordChange: true });
  const user = await getCurrentUser();
  if (!user?.mustChangePassword) return null;
  return (
    <p className="max-w-sm rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      Estás usando una contraseña temporal. Elige una propia para continuar.
    </p>
  );
}
