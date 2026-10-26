import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { customerStatementPath } from "@/modules/receivables/presentation/statement-routes";
import { isDomainError } from "@/shared/domain/domain-error";
import { Money } from "@/shared/domain/money";
import { getDb } from "@/shared/infrastructure/db/client";
import { formatMoney } from "@/shared/presentation/format";
import { notFoundAsNull } from "@/shared/presentation/not-found";
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
    <div className="flex max-w-5xl flex-col gap-8">
      <p className="text-sm text-muted-foreground">
        Hoja «{batch.sheetName}». La deuda según la planilla se calcula con sus filas (cantidad × precio) y
        los pagos y devoluciones del resumen; la pasada es lo que quedó en el sistema.{" "}
        {differing === 0
          ? "Todas coinciden."
          : `${differing} ${differing === 1 ? "cliente tiene" : "clientes tienen"} diferencias por explicar antes de empezar a usar el sistema.`}
      </p>
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
                  <Link href={customerStatementPath(row.customerId)} className="hover:underline">
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
                className={`text-right font-medium tabular-nums ${row.difference.isZero() ? "text-muted-foreground" : "text-amber-800 dark:text-amber-200"}`}
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
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Filas que no se pasaron</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {skipped.map((row) => (
              <li key={`${row.row}-${row.reason}`}>
                Fila {row.row}: {SKIP_REASONS[row.reason]} ({row.label})
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Pasa los clientes o productos que faltan, deshaz la conversión y vuelve a pasarla.
          </p>
        </section>
      )}
      <p className="text-sm">
        <Link href={importReviewPath(batch.id)} className="hover:underline">
          Observaciones de la planilla
        </Link>{" "}
        ·{" "}
        <Link href={importConversionPath(batch.id)} className="hover:underline">
          Volver a pasar al sistema
        </Link>
      </p>
    </div>
  );
}
