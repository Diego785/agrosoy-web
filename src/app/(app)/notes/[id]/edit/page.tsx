import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { EditNote, NoteFormSkeleton } from "@/modules/sales/presentation/note-pages";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Editar boleta" };

export default function EditNotePage({ params }: PageProps<"/notes/[id]/edit">) {
  return (
    <>
      <PageHeader back={{ href: "/notes", label: "Boletas" }} title="Editar borrador de boleta" />
      <Suspense fallback={<NoteFormSkeleton />}>
        <RequirePermission permission="notes.manage">
          <EditNote params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
