import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { CorrectNote, NoteDetailSkeleton } from "@/modules/sales/presentation/note-pages";
import { NOTES_PATH } from "@/modules/sales/presentation/note-routes";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Corregir boleta" };

export default function CorrectNotePage({ params }: PageProps<"/notes/[id]/correct">) {
  return (
    <>
      <PageHeader back={{ href: NOTES_PATH, label: "Boletas" }} title="Corregir boleta de planilla" />
      <Suspense fallback={<NoteDetailSkeleton />}>
        <RequirePermission permission="imports.manage">
          <CorrectNote params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
