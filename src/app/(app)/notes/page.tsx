import { ArrowRightLeftIcon, PlusIcon, Undo2Icon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { NotesTable, NotesTableSkeleton } from "@/modules/sales/presentation/note-pages";
import { followUpPath, NEW_NOTE_PATH } from "@/modules/sales/presentation/note-routes";
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
              <div className="flex flex-wrap gap-2">
                <Link href={followUpPath("return")} className={buttonVariants({ variant: "outline" })}>
                  <Undo2Icon aria-hidden />
                  Devolución
                </Link>
                <Link href={followUpPath("transfer")} className={buttonVariants({ variant: "outline" })}>
                  <ArrowRightLeftIcon aria-hidden />
                  Traspaso
                </Link>
                <Link href={NEW_NOTE_PATH} className={buttonVariants()}>
                  <PlusIcon aria-hidden />
                  Nueva boleta
                </Link>
              </div>
            </RequirePermission>
          </Suspense>
        }
      />
      <Suspense fallback={<NotesTableSkeleton />}>
        <RequirePermission permission="notes.view">
          <NotesTable searchParams={searchParams} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
