import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { FollowUpPage, FollowUpPageSkeleton } from "@/modules/sales/presentation/follow-up-pages";
import { NOTES_PATH } from "@/modules/sales/presentation/note-routes";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Devolución" };

export default function ReturnNotePage({ searchParams }: PageProps<"/notes/return">) {
  return (
    <>
      <PageHeader
        back={{ href: NOTES_PATH, label: "Boletas" }}
        title="Registrar devolución"
        description="Producto que el cliente devuelve, de cualquiera de las boletas que recibió en la campaña."
      />
      <Suspense fallback={<FollowUpPageSkeleton />}>
        <RequirePermission permission="notes.manage">
          <FollowUpPage searchParams={searchParams} mode="return" />
        </RequirePermission>
      </Suspense>
    </>
  );
}
