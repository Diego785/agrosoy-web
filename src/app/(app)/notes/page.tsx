import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { NotesTable } from "@/modules/sales/presentation/note-pages";
import { NEW_NOTE_PATH } from "@/modules/sales/presentation/note-routes";
import { PageHeader } from "@/shared/presentation/app-shell";
import { buttonVariants } from "@/shared/presentation/ui/button";

export const metadata: Metadata = { title: "Boletas" };

export default function NotesPage({ searchParams }: PageProps<"/notes">) {
  return (
    <>
      <PageHeader
        title="Boletas"
        description="Entregas a clientes. Al confirmarlas reciben su número y se cargan a la deuda del cliente."
        actions={
          <Suspense>
            <RequirePermission permission="notes.manage" fallback={null}>
              <Link href={NEW_NOTE_PATH} className={buttonVariants()}>
                Nueva boleta
              </Link>
            </RequirePermission>
          </Suspense>
        }
      />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-muted/60" />}>
        <RequirePermission permission="notes.view">
          <NotesTable searchParams={searchParams} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
