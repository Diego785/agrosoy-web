import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import {
  ImportIssuesList,
  ImportIssuesListSkeleton,
} from "@/modules/migration/presentation/import-issues-list";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Revisión de la planilla" };

export default function ImportReviewPage({ params }: PageProps<"/imports/[batchId]">) {
  return (
    <>
      <PageHeader
        back={{ href: "/imports", label: "Planillas" }}
        title="Revisión de la planilla"
        description="Lo que conviene corregir o confirmar antes de migrar los datos."
      />
      <Suspense fallback={<ImportIssuesListSkeleton />}>
        <RequirePermission permission="imports.manage">
          <ImportIssuesList params={params} />
        </RequirePermission>
      </Suspense>
    </>
  );
}
