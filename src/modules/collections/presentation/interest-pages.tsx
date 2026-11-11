import { PercentIcon } from "lucide-react";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { getDb } from "@/shared/infrastructure/db/client";
import { todayInBolivia } from "@/shared/presentation/business-date";
import { EmptyState } from "@/shared/presentation/empty-state";
import { formatDate, formatUsd } from "@/shared/presentation/format";
import { CardListSkeleton, Loading, Skeleton, TableSkeleton } from "@/shared/presentation/skeletons";
import { pendingInterest } from "../application/late-interest";
import { lateInterestDeps } from "./collection-deps";
import { InterestProposals } from "./interest-proposals";
import { InterestSettingsForm } from "./interest-settings-form";

/** Late-payment interest (D38): how it is charged, and the charges waiting for administration. */
export async function InterestPanel() {
  const actor = await requireActor();
  const { settings, proposals, totalUsd, nextDueOn } = await pendingInterest(
    lateInterestDeps(getDb()),
    actor,
  );

  return (
    <div className="flex flex-col gap-6">
      <InterestSettingsForm settings={settings} suggestedStart={nextDueOn ?? todayInBolivia()} />
      {settings.startsOn &&
        (proposals.length === 0 ? (
          <EmptyState icon={<PercentIcon />} title="No hay intereses por confirmar">
            Aparecen aquí cuando un cliente sigue debiendo después de un vencimiento.
            {nextDueOn && ` El próximo es el ${formatDate(nextDueOn)}.`}
          </EmptyState>
        ) : (
          <section aria-labelledby="interest-proposals" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="interest-proposals" className="text-sm font-semibold">
                Por confirmar
              </h2>
              <span className="text-sm text-muted-foreground">En total {formatUsd(totalUsd)}</span>
            </div>
            <InterestProposals proposals={proposals} />
          </section>
        ))}
    </div>
  );
}

/** `InterestPanel` while it loads. */
export function InterestPanelSkeleton() {
  return (
    <Loading label="Cargando intereses por mora">
      <div aria-hidden className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs">
        <Skeleton className="size-7 rounded-lg" />
        <Skeleton className="h-4 w-64" />
      </div>
      <TableSkeleton
        columns={[
          { shape: "badge", className: "w-10" },
          { shape: "text" },
          { shape: "short" },
          { shape: "short", className: "w-32" },
          { shape: "short", align: "right" },
          { shape: "short", align: "right" },
        ]}
      />
      <CardListSkeleton lines={3} />
    </Loading>
  );
}
