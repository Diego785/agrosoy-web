import { ArrowRightLeftIcon, FileSpreadsheetIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { previewPath } from "@/modules/receivables/presentation/statement-routes";
import { getDb } from "@/shared/infrastructure/db/client";
import { EmptyState } from "@/shared/presentation/empty-state";
import { formatCount, formatDateTime } from "@/shared/presentation/format";
import { CardField, CardList, CardListItem, WideOnly } from "@/shared/presentation/responsive-list";
import { CardListSkeleton, Loading, Skeleton, TableSkeleton } from "@/shared/presentation/skeletons";
import { Badge } from "@/shared/presentation/ui/badge";
import { buttonVariants } from "@/shared/presentation/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import { listImportBatches } from "../application/import-use-cases";
import { migrationDeps } from "./migration-deps";
import { importConversionPath, importReviewPath } from "./migration-routes";

export async function ImportBatches() {
  const actor = await requireActor();
  const batches = await listImportBatches(migrationDeps(getDb()), actor);

  if (batches.length === 0) {
    return <EmptyState icon={<FileSpreadsheetIcon />} title="Todavía no se importó ninguna planilla." />;
  }
  return (
    <section aria-labelledby="import-batches" className="flex flex-col gap-3">
      <h2 id="import-batches" className="text-sm font-semibold">
        Planillas importadas
      </h2>
      <WideOnly>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hoja</TableHead>
              <TableHead>Campaña</TableHead>
              <TableHead className="text-right">Filas</TableHead>
              <TableHead className="text-right">Clientes</TableHead>
              <TableHead>Revisión</TableHead>
              <TableHead>Importada</TableHead>
              <TableHead>
                <span className="sr-only">Estado de cuenta</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((batch) => (
              <TableRow key={batch.id}>
                <TableCell>
                  <span className="font-medium">{batch.sheetName}</span>
                  <span className="block text-xs text-muted-foreground">{batch.fileName}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">{batch.campaignLabel ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(batch.lineCount)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(batch.customerCount)}</TableCell>
                <TableCell>
                  <ReviewLink batch={batch} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {formatDateTime(batch.importedAt)}
                </TableCell>
                <TableCell>
                  <BatchLinks batchId={batch.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </WideOnly>
      <CardList label="Planillas importadas">
        {batches.map((batch) => (
          <CardListItem key={batch.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{batch.sheetName}</span>
                <span className="truncate text-xs text-muted-foreground">{batch.fileName}</span>
              </div>
              <ReviewLink batch={batch} />
            </div>
            <CardField label="Campaña">{batch.campaignLabel ?? "—"}</CardField>
            <CardField label="Filas / clientes">
              {formatCount(batch.lineCount)} / {formatCount(batch.customerCount)}
            </CardField>
            <CardField label="Importada">{formatDateTime(batch.importedAt)}</CardField>
            <div className="pt-1">
              <BatchLinks batchId={batch.id} />
            </div>
          </CardListItem>
        ))}
      </CardList>
    </section>
  );
}

/**
 * The imports page while it loads. The upload form waits in the same `<Suspense>` as the list (both
 * need the permission), so this draws the form card above the imported sheets.
 */
export function ImportBatchesSkeleton() {
  return (
    <Loading label="Cargando planillas" className="gap-6">
      <div aria-hidden className="flex max-w-2xl flex-col gap-2 rounded-xl border bg-card p-5 shadow-xs">
        <Skeleton className="my-0.5 h-3.5 w-44" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 max-w-sm flex-1 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <div className="flex flex-col gap-1.5 py-0.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      </div>
      <div aria-hidden className="flex flex-col gap-3">
        <Skeleton className="my-0.5 h-4 w-36" />
        <TableSkeleton
          rows={4}
          columns={[
            { shape: "stacked" },
            { shape: "short" },
            { shape: "code", align: "right" },
            { shape: "code", align: "right" },
            { shape: "badge" },
            { shape: "text" },
            { shape: "tags" },
          ]}
        />
        <CardListSkeleton rows={3} lines={3} tags />
      </div>
    </Loading>
  );
}

function BatchLinks({ batchId }: { batchId: string }) {
  return (
    <div className="flex flex-wrap gap-2 md:justify-end">
      <Link href={previewPath(batchId)} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <WalletIcon aria-hidden />
        Estado de cuenta
      </Link>
      <Link
        href={importConversionPath(batchId)}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <ArrowRightLeftIcon aria-hidden />
        Pasar al sistema
      </Link>
    </div>
  );
}

function ReviewLink({ batch }: { batch: { id: string; issueCount: number } }) {
  return (
    <Link href={importReviewPath(batch.id)} className="shrink-0">
      {batch.issueCount === 0 ? (
        <Badge variant="success">Sin observaciones</Badge>
      ) : (
        <Badge variant="warning">
          {batch.issueCount === 1 ? "1 observación" : `${formatCount(batch.issueCount)} observaciones`}
        </Badge>
      )}
    </Link>
  );
}
