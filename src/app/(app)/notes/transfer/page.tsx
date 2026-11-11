import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { FollowUpPage, FollowUpPageSkeleton } from "@/modules/sales/presentation/follow-up-pages";
import { NOTES_PATH } from "@/modules/sales/presentation/note-routes";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Traspaso de campaña" };

export default function TransferNotePage({ searchParams }: PageProps<"/notes/transfer">) {
  return (
    <>
      <PageHeader
        back={{ href: NOTES_PATH, label: "Boletas" }}
        title="Registrar traspaso"
        description="Producto que el cliente todavía tiene y pasa a la nueva campaña, al precio nuevo."
      />
      <Suspense fallback={<FollowUpPageSkeleton />}>
        <RequirePermission permission="notes.manage">
          <FollowUpPage searchParams={searchParams} mode="transfer" />
        </RequirePermission>
      </Suspense>
    </>
  );
}
