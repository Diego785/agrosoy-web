import { z } from "zod";
import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError, isDomainError } from "@/shared/domain/domain-error";
import { parseSalesSheet, type ImportIssue } from "../domain/sales-sheet";
import type { ImportBatch, ImportRepository, WorkbookReader } from "./ports";

export const MAX_WORKBOOK_BYTES = 5 * 1024 * 1024;

export type ImportDeps = {
  imports: ImportRepository;
  workbooks: WorkbookReader;
  audit: AuditTrail;
};

export type ImportedSheetResult = {
  batchId: string;
  sheetName: string;
  campaignLabel: string | null;
  lineCount: number;
  issueCount: number;
  replaced: boolean;
};

const workbookSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  content: z.instanceof(Uint8Array),
});

/**
 * Reads every sheet of a technician sales workbook into the import tables. Sheets without a
 * sales table (notes, charts) are listed as skipped rather than failing the whole file.
 */
export async function importSalesWorkbook(
  deps: ImportDeps,
  actor: Actor,
  input: unknown,
): Promise<{ sheets: ImportedSheetResult[]; skippedSheets: string[] }> {
  assertCan(actor, "imports.manage");
  const { fileName, content } = validateInput(workbookSchema, input);
  if (
    !fileName.toLowerCase().endsWith(".xlsx") ||
    content.byteLength === 0 ||
    content.byteLength > MAX_WORKBOOK_BYTES
  ) {
    throw new DomainError("INVALID_FILE", { fileName, bytes: content.byteLength });
  }

  const sheets: ImportedSheetResult[] = [];
  const skippedSheets: string[] = [];
  for (const grid of await deps.workbooks.read(content)) {
    const sheet = parseSalesSheet(grid);
    if (sheet.issues.some((issue) => issue.code === "HEADER_NOT_FOUND")) {
      skippedSheets.push(grid.name);
      continue;
    }
    const { batchId, replaced } = await deps.imports
      .replaceSheet({ fileName, importedBy: actor.id, sheet })
      .catch((error: unknown) => {
        if (isDomainError(error) && error.code === "INVALID_STATE") {
          throw new DomainError("VALIDATION_FAILED", {
            fieldErrors: {
              file: [
                `Las ventas de la hoja «${sheet.sheetName}» ya están en el sistema; deshaz esa conversión antes de importarla de nuevo.`,
              ],
            },
          });
        }
        throw error;
      });
    await deps.audit.record({
      actorId: actor.id,
      action: "migration.import_sheet",
      entityType: "import_batch",
      entityId: batchId,
      payload: {
        fileName,
        sheetName: sheet.sheetName,
        campaignLabel: sheet.campaignLabel,
        lines: sheet.lines.length,
        issues: sheet.issues.length,
        replaced,
      },
    });
    sheets.push({
      batchId,
      sheetName: sheet.sheetName,
      campaignLabel: sheet.campaignLabel,
      lineCount: sheet.lines.length,
      issueCount: sheet.issues.length,
      replaced,
    });
  }
  return { sheets, skippedSheets };
}

/** Imported sheets, for the import page and as sources of the statement preview. */
export async function listImportBatches(
  deps: Pick<ImportDeps, "imports">,
  actor: Actor,
): Promise<ImportBatch[]> {
  assertCan(actor, "statements.view");
  return deps.imports.listBatches();
}

export async function importIssues(
  deps: Pick<ImportDeps, "imports">,
  actor: Actor,
  batchId: unknown,
): Promise<{ batch: ImportBatch; issues: ImportIssue[] }> {
  assertCan(actor, "imports.manage");
  const batch = await findBatch(deps.imports, batchId);
  return { batch, issues: await deps.imports.issues(batch.id) };
}

export async function findBatch(imports: ImportRepository, batchId: unknown): Promise<ImportBatch> {
  const id = validateInput(z.uuid(), batchId);
  const batch = await imports.findBatch(id);
  if (!batch) throw new DomainError("NOT_FOUND", { entity: "import_batch", id });
  return batch;
}
