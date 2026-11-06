import { TriangleAlertIcon } from "lucide-react";
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
    <p className="flex max-w-md items-start gap-3 rounded-xl border border-warning/30 bg-warning/8 p-4 text-sm">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      Estás usando una contraseña temporal. Elige una propia para continuar.
    </p>
  );
}
