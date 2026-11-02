import type { Metadata } from "next";
import { Suspense } from "react";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import {
  StatementSources,
  StatementSourcesSkeleton,
} from "@/modules/migration/presentation/statement-preview";
import { PageHeader } from "@/shared/presentation/app-shell";

export const metadata: Metadata = { title: "Estados de cuenta" };

export default function StatementsPage() {
  return (
    <>
      <PageHeader title="Estados de cuenta" description="Elige la planilla del técnico y la campaña." />
      <Suspense fallback={<StatementSourcesSkeleton />}>
        <RequirePermission permission="statements.view">
          <StatementSources />
        </RequirePermission>
      </Suspense>
    </>
  );
}
