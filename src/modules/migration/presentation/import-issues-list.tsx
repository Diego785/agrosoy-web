import { notFound } from "next/navigation";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { formatDate, formatUsd } from "@/shared/presentation/format";
import { importIssues } from "../application/import-use-cases";
import type { ImportIssue, ImportIssueCode } from "../domain/sales-sheet";
import { migrationDeps } from "./migration-deps";

const FIELD_LABELS: Record<string, string> = {
  product: "producto",
  customer: "cliente",
  quantity: "cantidad",
  price: "precio",
};

type Describe = (details: Record<string, string>) => string;

/** "2026-07-14, 2026-08-13" → "14/07/2026, 13/08/2026"; an empty entry is a row without date. */
function listOfDates(dates = ""): string {
  return dates
    .split(", ")
    .map((date) => (date ? formatDate(date) : "sin fecha"))
    .join(", ");
}

/** How each finding reads for administration. Amounts in details are US$ decimal strings. */
const DESCRIPTIONS: Record<ImportIssueCode, Describe> = {
  HEADER_NOT_FOUND: () => "La hoja no tiene la tabla de ventas (FECHA, PRODUCTO, CLIENTE).",
  INVALID_VALUE: (d) =>
    `Falta el ${FIELD_LABELS[d.field ?? ""] ?? "dato"} o no es un número; la fila no se importó.`,
  INVALID_DATE: (d) => (d.value ? `La fecha «${d.value}» no es válida.` : "La fila no tiene fecha."),
  ROUNDED_VALUE: (d) => `El ${FIELD_LABELS[d.field ?? ""] ?? "valor"} ${d.value} se redondeó a ${d.rounded}.`,
  MISSING_EXCHANGE_RATE: () => "Ventas sin tipo de cambio.",
  ZERO_PRICE: (d) =>
    `Precio 0${d.observation ? ` (observación «${d.observation}»)` : ""}: se toma como entrega sin costo.`,
  LINE_TOTAL_MISMATCH: (d) =>
    `El total de la planilla (${formatUsd(d.sheet ?? "0")}) no es cantidad × precio (${formatUsd(d.computed ?? "0")}).`,
  SHEET_TOTAL_MISMATCH: (d) =>
    `El «Total» de la planilla dice ${formatUsd(d.sheet ?? "0")}, pero las filas suman ${formatUsd(d.computed ?? "0")}: su fórmula deja filas fuera.`,
  NOTE_NUMBER_REUSED: (d) =>
    `La boleta ${d.note} aparece con fechas distintas (${listOfDates(d.dates)}) en las filas ${d.rows}.`,
  CUSTOMER_NOT_IN_SUMMARY: (d) => `${d.customer} tiene ventas pero no está en el resumen de deudas.`,
  SUMMARY_CUSTOMER_UNMATCHED: (d) => `${d.customer} está en el resumen pero no tiene ventas en la planilla.`,
  SUMMARY_DELIVERED_MISMATCH: (d) =>
    `En el resumen, la entrega de ${d.customer} es ${formatUsd(d.sheet ?? "0")}, pero sus filas suman ${formatUsd(d.computed ?? "0")}.`,
};

type Finding = { rows: number[]; text: string };

/** Findings that repeat without details (e.g. missing exchange rates) read as one line with their rows. */
function findings(issues: ImportIssue[]): Finding[] {
  const grouped = new Map<string, Finding>();
  for (const issue of issues) {
    const text = DESCRIPTIONS[issue.code](issue.details);
    const key = Object.keys(issue.details).length === 0 ? issue.code : `${issue.code}:${issue.row}:${text}`;
    const finding = grouped.get(key) ?? { rows: [], text };
    if (issue.row !== null) finding.rows.push(issue.row);
    grouped.set(key, finding);
  }
  return [...grouped.values()];
}

export async function ImportIssuesList({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const actor = await requireActor();
  const { batch, issues } = await importIssues(migrationDeps(getDb()), actor, batchId).catch(
    (error: unknown) => {
      if (isDomainError(error) && (error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED"))
        notFound();
      throw error;
    },
  );

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Hoja «{batch.sheetName}» · {batch.campaignLabel ?? "sin campaña"} · {batch.fileName}
      </p>
      {issues.length === 0 ? (
        <p className="text-sm">La planilla no tiene observaciones.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {findings(issues).map((finding) => (
            <li key={`${finding.text}:${finding.rows.join(",")}`} className="flex gap-4 px-4 py-3 text-sm">
              <span className="w-28 shrink-0 text-muted-foreground tabular-nums">
                {finding.rows.length === 0
                  ? "Hoja"
                  : finding.rows.length === 1
                    ? `Fila ${finding.rows[0]}`
                    : `${finding.rows.length} filas`}
              </span>
              <span>
                {finding.text}
                {finding.rows.length > 1 && (
                  <span className="block text-xs text-muted-foreground">Filas {finding.rows.join(", ")}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
