import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { FollowUpPage } from "@/modules/sales/presentation/follow-up-pages";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Traspaso de campaña" };

export default function TransferNotePage({ params }: PageProps<"/notes/[id]/transfer">) {
  return (
    <>
      <PageHeader title="Pasar a otra campaña" />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/60" />}>
        <RequirePermission permission="notes.manage">
          <FollowUpPage params={params} mode="transfer" />
        </RequirePermission>
      </Suspense>
    </>
  );
}
