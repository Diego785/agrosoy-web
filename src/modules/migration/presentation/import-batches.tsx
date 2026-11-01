import Link from "next/link";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { statementPath } from "@/modules/receivables/presentation/statement-routes";
import { getDb } from "@/shared/infrastructure/db/client";
import { formatCount, formatDateTime } from "@/shared/presentation/format";
import { CardField, CardList, CardListItem, WideOnly } from "@/shared/presentation/responsive-list";
import { Badge } from "@/shared/presentation/ui/badge";
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
    return <p className="text-sm text-muted-foreground">Todavía no se importó ninguna planilla.</p>;
  }
  return (
    <>
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
                <TableCell>{batch.campaignLabel ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(batch.lineCount)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCount(batch.customerCount)}</TableCell>
                <TableCell>
                  <ReviewLink batch={batch} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateTime(batch.importedAt)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 text-sm font-medium">
                    <Link href={statementPath(batch.id)} className="hover:underline">
                      Estado de cuenta
                    </Link>
                    <Link href={importConversionPath(batch.id)} className="hover:underline">
                      Pasar al sistema
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </WideOnly>
      <CardList label="Planillas importadas">
        {batches.map((batch) => (
          <CardListItem key={batch.id}>
            <div className="flex flex-col">
              <span className="font-medium">{batch.sheetName}</span>
              <span className="text-xs text-muted-foreground">{batch.fileName}</span>
            </div>
            <CardField label="Campaña">{batch.campaignLabel ?? "—"}</CardField>
            <CardField label="Filas / clientes">
              {formatCount(batch.lineCount)} / {formatCount(batch.customerCount)}
            </CardField>
            <CardField label="Importada">{formatDateTime(batch.importedAt)}</CardField>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <ReviewLink batch={batch} />
              <div className="flex gap-4 font-medium">
                <Link href={statementPath(batch.id)} className="hover:underline">
                  Estado de cuenta
                </Link>
                <Link href={importConversionPath(batch.id)} className="hover:underline">
                  Pasar al sistema
                </Link>
              </div>
            </div>
          </CardListItem>
        ))}
      </CardList>
    </>
  );
}

function ReviewLink({ batch }: { batch: { id: string; issueCount: number } }) {
  return (
    <Link href={importReviewPath(batch.id)}>
      {batch.issueCount === 0 ? (
        <Badge variant="secondary">Sin observaciones</Badge>
      ) : (
        <Badge variant="outline">
          {batch.issueCount === 1 ? "1 observación" : `${formatCount(batch.issueCount)} observaciones`}
        </Badge>
      )}
    </Link>
  );
}
