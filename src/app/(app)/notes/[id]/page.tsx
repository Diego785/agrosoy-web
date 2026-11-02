import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { NoteDetail } from "@/modules/sales/presentation/note-pages";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Boleta" };

export default function NotePage({ params }: PageProps<"/notes/[id]">) {
  return (
    <>
      <PageHeader back={{ href: "/notes", label: "Boletas" }} title="Boleta" />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/60" />}>
        <RequirePermission permission="notes.view">
          <NoteDetail params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
