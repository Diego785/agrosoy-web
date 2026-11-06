import { ArrowLeftIcon, ChevronRightIcon, FileSpreadsheetIcon, UploadIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/modules/identity/presentation/current-user";
import {
  CustomerStatement,
  CustomerStatementSkeleton,
} from "@/modules/receivables/presentation/customer-statement";
import {
  PortfolioStatement,
  PortfolioStatementSkeleton,
} from "@/modules/receivables/presentation/portfolio-statement";
import { customerPreviewPath, previewPath } from "@/modules/receivables/presentation/statement-routes";
import { can } from "@/shared/application/permissions";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { EmptyState } from "@/shared/presentation/empty-state";
import { formatCount, formatDateTime } from "@/shared/presentation/format";
import { Loading, Skeleton } from "@/shared/presentation/skeletons";
import { buttonVariants } from "@/shared/presentation/ui/button";
import { listImportBatches } from "../application/import-use-cases";
import { customerStatementFromImport, portfolioStatementFromImport } from "../application/statement-preview";
import { migrationDeps } from "./migration-deps";
import { IMPORTS_PATH } from "./migration-routes";

/** Imported sheets to choose from, to compare what they say with the ledger. */
export async function StatementSources() {
  const actor = await requireActor();
  const batches = await listImportBatches(migrationDeps(getDb()), actor);

  if (batches.length === 0) {
    return (
      <EmptyState
        icon={<WalletIcon />}
        title="Todavía no hay datos para mostrar."
        action={
          can(actor, "imports.manage") && (
            <Link href={IMPORTS_PATH} className={buttonVariants({ variant: "outline" })}>
              <UploadIcon aria-hidden />
              Importa la planilla de ventas
            </Link>
          )
        }
      />
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {batches.map((batch) => (
        <li key={batch.id}>
          <Link
            href={previewPath(batch.id)}
            className="group flex h-full items-start gap-4 rounded-xl border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
              <FileSpreadsheetIcon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium group-hover:text-primary">{batch.sheetName}</span>
              <span className="block text-sm text-muted-foreground">
                {batch.campaignLabel ?? "Sin campaña"}
              </span>
              <span className="mt-2 block text-xs text-muted-foreground">
                {formatCount(batch.customerCount)} clientes · importada {formatDateTime(batch.importedAt)}
              </span>
            </span>
            <ChevronRightIcon
              className="mt-0.5 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The sheets to choose from while they load, as cards like `StatementSources`. */
export function StatementSourcesSkeleton() {
  return (
    <Loading label="Cargando planillas">
      <ul aria-hidden className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <li key={index} className="flex items-start gap-4 rounded-xl border bg-card p-5 shadow-xs">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col">
              <Skeleton className="my-1 h-4 w-32" />
              <Skeleton className="my-[3px] h-3.5 w-20" />
              <Skeleton className="mt-2.5 mb-0.5 h-3 w-44 max-w-full" />
            </div>
            <Skeleton className="mt-0.5 size-4" />
          </li>
        ))}
      </ul>
    </Loading>
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
      customerHref={(customerKey) => customerPreviewPath(batchId, customerKey)}
    />
  );
}

export function PortfolioStatementPreviewSkeleton() {
  return (
    <Loading label="Cargando estado de cuenta">
      <PortfolioStatementSkeleton />
    </Loading>
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
      <h2 className="-mt-2 text-xl font-semibold tracking-tight">{statement.customerName}</h2>
      <CustomerStatement statement={statement} />
      <Link
        href={previewPath(batchId)}
        className={buttonVariants({ variant: "outline", className: "self-start print:hidden" })}
      >
        <ArrowLeftIcon aria-hidden />
        Volver a todos los clientes
      </Link>
    </>
  );
}

/** The customer's name over their statement and the way back, like `CustomerStatementPreview`. */
export function CustomerStatementPreviewSkeleton() {
  return (
    <Loading label="Cargando estado de cuenta del cliente" className="gap-6">
      <Skeleton className="-mt-2 h-7 w-56" />
      <CustomerStatementSkeleton />
      <Skeleton className="h-9 w-60 self-start rounded-lg" />
    </Loading>
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
