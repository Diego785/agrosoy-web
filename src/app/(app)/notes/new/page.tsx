import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { NewNote, NoteFormSkeleton } from "@/modules/sales/presentation/note-pages";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Nueva boleta" };

export default function NewNotePage() {
  return (
    <>
      <PageHeader back={{ href: "/notes", label: "Boletas" }} title="Nueva boleta de entrega" />
      <Suspense fallback={<NoteFormSkeleton />}>
        <RequirePermission permission="notes.manage">
          <NewNote />
        </RequirePermission>
      </Suspense>
    </>
  );
}
