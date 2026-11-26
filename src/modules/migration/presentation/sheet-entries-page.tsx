import { InfoIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { customerStatementPath } from "@/modules/receivables/presentation/statement-routes";
import { getDb } from "@/shared/infrastructure/db/client";
import { EmptyState } from "@/shared/presentation/empty-state";
import { formatDate, formatMoney } from "@/shared/presentation/format";
import { notFoundAsNull } from "@/shared/presentation/not-found";
import { Loading, Skeleton } from "@/shared/presentation/skeletons";
import { salesReconciliation, sheetEntriesOf } from "../application/sales-conversion";
import { salesConversionDeps } from "../infrastructure/conversion-adapters";
import { reconciliationPath } from "./migration-routes";
import { SheetEntryForm } from "./sheet-entries-form";

const KIND_LABELS = { payment: "Pago", return: "Devolución" } as const;

/** What a converted sheet brought in for one customer besides notes, each amount correctable (D60). */
export async function SheetEntriesPage({
  params,
}: {
  params: Promise<{ batchId: string; customerId: string }>;
}) {
  const { batchId, customerId } = await params;
  const actor = await requireActor();
  const deps = salesConversionDeps(getDb(), actor);
  const [entries, reconciliation] = await Promise.all([
    sheetEntriesOf(deps, actor, { batchId, customerId }).catch(notFoundAsNull),
    salesReconciliation(deps, actor, batchId).catch(notFoundAsNull),
  ]);
  const row = reconciliation?.rows.find((candidate) => candidate.customerId === customerId);
  if (!entries || !row) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">
          <Link href={customerStatementPath(customerId)} className="hover:text-primary">
            {row.customerName}
          </Link>
        </h2>
        <p className="text-sm text-muted-foreground">
          Hoja «{entries.batch.sheetName}» ·{" "}
          <Link href={reconciliationPath(entries.batch.id)} className="hover:text-primary hover:underline">
            Volver a la conciliación
          </Link>
        </p>
      </div>
      <p className="flex items-start gap-3 rounded-xl border border-info/25 bg-info/5 px-4 py-3 text-sm">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        <span className="text-muted-foreground">
          Lo que la planilla trajo además de las boletas. Cambia el monto que vino mal y explica por qué: la
          deuda se corrige con la misma fecha y el cambio queda en el registro de cambios. En 0, ese pago o
          devolución deja de contar. Las boletas se corrigen desde cada boleta.
        </span>
      </p>
      {entries.entries.length === 0 ? (
        <EmptyState icon={<InfoIcon />} title="La planilla no trajo pagos ni devoluciones de este cliente" />
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">
                  {KIND_LABELS[entry.kind]} del {formatDate(entry.date)}
                </span>
                <span className="font-semibold tabular-nums">US$ {formatMoney(entry.amount)}</span>
              </p>
              <SheetEntryForm batchId={entries.batch.id} entryId={entry.id} amount={entry.amount} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SheetEntriesPageSkeleton() {
  return (
    <Loading label="Cargando pagos y devoluciones" className="max-w-3xl gap-6">
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </Loading>
  );
}
