import { CheckCircle2Icon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { customerStatementPath } from "@/modules/receivables/presentation/statement-routes";
import { isDomainError } from "@/shared/domain/domain-error";
import { Money } from "@/shared/domain/money";
import { getDb } from "@/shared/infrastructure/db/client";
import { formatMoney } from "@/shared/presentation/format";
import { notFoundAsNull } from "@/shared/presentation/not-found";
import { Loading, Skeleton, TableSkeleton } from "@/shared/presentation/skeletons";
import { buttonVariants } from "@/shared/presentation/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import { salesReconciliation, type SkippedRow } from "../application/sales-conversion";
import { salesConversionDeps } from "../infrastructure/conversion-adapters";
import { importConversionPath, importReviewPath } from "./migration-routes";

const SKIP_REASONS: Record<SkippedRow["reason"], string> = {
  customer_missing: "El cliente no está en el sistema",
  product_missing: "El producto no está en el sistema",
};

/** Each customer's debt per the sheet next to what was converted; differences need an explanation. */
export async function ReconciliationPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const actor = await requireActor();
  const result = await salesReconciliation(salesConversionDeps(getDb(), actor), actor, batchId).catch(
    (error: unknown) =>
      // Before converting there is nothing to reconcile.
      isDomainError(error) && error.code === "INVALID_STATE" ? null : notFoundAsNull(error),
  );
  if (!result) notFound();
  const { batch, rows, skipped } = result;
  const total = (pick: (row: (typeof rows)[number]) => Money) => Money.sum(rows.map(pick)).toDecimalString();
  const differing = rows.filter((row) => !row.difference.isZero()).length;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <p className="flex items-start gap-3 rounded-xl border border-info/25 bg-info/5 px-4 py-3 text-sm">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        <span>
          <span className="font-medium">Hoja «{batch.sheetName}».</span>{" "}
          <span className="text-muted-foreground">
            La deuda según la planilla se calcula con sus filas (cantidad × precio) y los pagos y devoluciones
            del resumen; la pasada es lo que quedó en el sistema.
          </span>
        </span>
      </p>
      {differing === 0 ? (
        <p className="flex items-center gap-2 text-sm font-medium text-success">
          <CheckCircle2Icon className="size-4 shrink-0" aria-hidden />
          Todas coinciden.
        </p>
      ) : (
        <p className="flex items-center gap-2 text-sm font-medium text-warning">
          <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
          {differing} {differing === 1 ? "cliente tiene" : "clientes tienen"} diferencias por explicar antes
          de empezar a usar el sistema.
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead className="text-right">Deuda según planilla</TableHead>
            <TableHead className="text-right">Deuda pasada</TableHead>
            <TableHead className="text-right">Diferencia</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.customerName}>
              <TableCell>
                {row.customerId ? (
                  <Link
                    href={customerStatementPath(row.customerId)}
                    className="font-medium hover:text-primary"
                  >
                    {row.customerName}
                  </Link>
                ) : (
                  <>
                    {row.customerName}{" "}
                    <span className="text-xs text-muted-foreground">(no está en el sistema)</span>
                  </>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(row.sheet.balance.toDecimalString())}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.converted ? formatMoney(row.converted.balance.toDecimalString()) : "—"}
              </TableCell>
              <TableCell
                className={`text-right font-medium tabular-nums ${row.difference.isZero() ? "text-muted-foreground" : "text-warning"}`}
              >
                {formatMoney(row.difference.toDecimalString())}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMoney(total((row) => row.sheet.balance))}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMoney(total((row) => row.converted?.balance ?? Money.zero()))}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMoney(total((row) => row.difference))}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>

      {skipped.length > 0 && (
        <section
          aria-labelledby="skipped-rows"
          className="overflow-hidden rounded-xl border bg-card shadow-xs"
        >
          <h3 id="skipped-rows" className="border-b px-5 py-3 text-sm font-semibold">
            Filas que no se pasaron
          </h3>
          <ul className="divide-y text-sm">
            {skipped.map((row) => (
              <li key={`${row.row}-${row.reason}`} className="px-5 py-3">
                <span className="font-medium">Fila {row.row}:</span> {SKIP_REASONS[row.reason]} ({row.label})
              </li>
            ))}
          </ul>
          <p className="border-t bg-muted/30 px-5 py-3 text-sm text-muted-foreground">
            Pasa los clientes o productos que faltan, deshaz la conversión y vuelve a pasarla.
          </p>
        </section>
      )}
      <div className="flex flex-wrap gap-2">
        <Link href={importReviewPath(batch.id)} className={buttonVariants({ variant: "outline" })}>
          Observaciones de la planilla
        </Link>
        <Link href={importConversionPath(batch.id)} className={buttonVariants({ variant: "outline" })}>
          Volver a pasar al sistema
        </Link>
      </div>
    </div>
  );
}

/** The reconciliation while it loads: the notice, the result, the customers and the links. */
export function ReconciliationPageSkeleton() {
  return (
    <Loading label="Cargando conciliación" className="max-w-5xl gap-6">
      <div
        aria-hidden
        className="flex items-start gap-3 rounded-xl border border-info/25 bg-info/5 px-4 py-3"
      >
        <Skeleton className="mt-0.5 size-4 shrink-0" />
        <Skeleton className="my-[3px] h-3.5 w-full max-w-lg" />
      </div>
      <Skeleton className="my-0.5 h-4 w-64" />
      <TableSkeleton
        className="block"
        rows={8}
        columns={[
          { shape: "text" },
          { shape: "short", align: "right" },
          { shape: "short", align: "right" },
          { shape: "short", align: "right" },
        ]}
      />
      <div aria-hidden className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-56 rounded-lg" />
        <Skeleton className="h-9 w-48 rounded-lg" />
      </div>
    </Loading>
  );
}
