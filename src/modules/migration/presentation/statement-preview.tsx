import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { CustomerStatement } from "@/modules/receivables/presentation/customer-statement";
import { PortfolioStatement } from "@/modules/receivables/presentation/portfolio-statement";
import { customerStatementPath, statementPath } from "@/modules/receivables/presentation/statement-routes";
import { can } from "@/shared/application/permissions";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { formatCount, formatDateTime } from "@/shared/presentation/format";
import { listImportBatches } from "../application/import-use-cases";
import { customerStatementFromImport, portfolioStatementFromImport } from "../application/statement-preview";
import { migrationDeps } from "./migration-deps";
import { IMPORTS_PATH } from "./migration-routes";

/** Imported sheets to choose from. Until the ledger exists (M7) they are the only source. */
export async function StatementSources() {
  const actor = await requireActor();
  const batches = await listImportBatches(migrationDeps(getDb()), actor);

  if (batches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay datos para mostrar.{" "}
        {can(actor, "imports.manage") && (
          <Link href={IMPORTS_PATH} className="font-medium text-foreground underline">
            Importa la planilla de ventas
          </Link>
        )}
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {batches.map((batch) => (
        <li key={batch.id}>
          <Link href={statementPath(batch.id)} className="block rounded-lg border p-4 hover:bg-muted/50">
            <span className="block font-medium">{batch.sheetName}</span>
            <span className="block text-sm text-muted-foreground">
              {batch.campaignLabel ?? "Sin campaña"}
            </span>
            <span className="mt-2 block text-xs text-muted-foreground">
              {formatCount(batch.customerCount)} clientes · importada {formatDateTime(batch.importedAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export async function PortfolioStatementPreview({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const actor = await requireActor();
  const statement = await portfolioStatementFromImport(migrationDeps(getDb()), actor, batchId).catch(
    notFoundOnMissing,
  );
  return (
    <PortfolioStatement
      statement={statement}
      customerHref={(customerKey) => customerStatementPath(batchId, customerKey)}
    />
  );
}

export async function CustomerStatementPreview({
  params,
}: {
  params: Promise<{ batchId: string; customerKey: string }>;
}) {
  const { batchId, customerKey } = await params;
  const actor = await requireActor();
  const statement = await customerStatementFromImport(
    migrationDeps(getDb()),
    actor,
    batchId,
    safeDecode(customerKey),
  ).catch(notFoundOnMissing);
  return (
    <>
      <h2 className="-mt-2 text-xl font-semibold">{statement.customerName}</h2>
      <CustomerStatement statement={statement} />
      <Link href={statementPath(batchId)} className="text-sm font-medium hover:underline print:hidden">
        ← Volver a todos los clientes
      </Link>
    </>
  );
}

function notFoundOnMissing(error: unknown): never {
  if (isDomainError(error) && (error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED")) notFound();
  throw error;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
