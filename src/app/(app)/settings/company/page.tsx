import type { Metadata } from "next";
import { Suspense } from "react";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { RequirePermission } from "@/modules/identity/presentation/require-permission";
import { getCompanyProfile } from "@/shared/application/company-profile";
import { drizzleSettingsStore } from "@/shared/infrastructure/db/app-settings";
import { getDb } from "@/shared/infrastructure/db/client";
import { PageHeader } from "@/shared/presentation/app-shell";
import { CompanyProfileForm } from "@/shared/presentation/company-profile-form";
import { FormSectionSkeleton } from "@/shared/presentation/form-section";
import { Loading, Skeleton } from "@/shared/presentation/skeletons";

export const metadata: Metadata = { title: "Datos de la empresa" };

async function CompanyProfileSettings() {
  const actor = await requireActor();
  const profile = await getCompanyProfile({ settings: drizzleSettingsStore(getDb()) }, actor);
  return <CompanyProfileForm profile={profile} />;
}

export default function CompanySettingsPage() {
  return (
    <>
      <PageHeader title="Datos de la empresa" />
      <Suspense
        fallback={
          <Loading label="Cargando datos de la empresa" className="max-w-3xl gap-6">
            <FormSectionSkeleton>
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="grid gap-5 sm:grid-cols-3">
                  {[0, 1, 2].map((cell) => (
                    <div key={cell} className="flex flex-col gap-2">
                      <Skeleton className="my-0.5 h-3.5 w-24" />
                      <Skeleton className="h-9 w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              ))}
            </FormSectionSkeleton>
          </Loading>
        }
      >
        <RequirePermission permission="company.manage">
          <CompanyProfileSettings />
        </RequirePermission>
      </Suspense>
    </>
  );
}
