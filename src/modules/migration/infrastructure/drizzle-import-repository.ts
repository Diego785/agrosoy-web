import { and, asc, count, countDistinct, desc, eq, isNotNull, sql } from "drizzle-orm";
import { DomainError } from "@/shared/domain/domain-error";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import type { ImportBatch, ImportRepository } from "../application/ports";
import type { ImportIssue, ImportIssueCode } from "../domain/sales-sheet";
import { importBatches, importedSalesLines, importedSummaryRows, importIssues } from "./import.tables";

export function drizzleImportRepository(executor: DbExecutor): ImportRepository {
  return {
    async replaceSheet({ fileName, importedBy, sheet }) {
      const campaignLabel = sheet.campaignLabel ?? "";
      const [converted] = await executor
        .select({ id: importBatches.id })
        .from(importBatches)
        .where(
          and(
            eq(importBatches.sheetName, sheet.sheetName),
            eq(importBatches.campaignLabel, campaignLabel),
            isNotNull(importBatches.salesConvertedAt),
          ),
        );
      if (converted)
        throw new DomainError("INVALID_STATE", { reason: "sales_converted", batchId: converted.id });
      const removed = await executor
        .delete(importBatches)
        .where(
          and(eq(importBatches.sheetName, sheet.sheetName), eq(importBatches.campaignLabel, campaignLabel)),
        )
        .returning({ id: importBatches.id });

      const [batch] = await executor
        .insert(importBatches)
        .values({ fileName, sheetName: sheet.sheetName, campaignLabel, importedBy })
        .returning({ id: importBatches.id });
      if (!batch) throw new Error("Insert returned no import batch");

      if (sheet.lines.length > 0) {
        await executor.insert(importedSalesLines).values(
          sheet.lines.map((line) => ({
            batchId: batch.id,
            rowNumber: line.row,
            kind: line.kind,
            saleDate: line.date,
            product: line.product,
            customerName: line.customerName,
            customerKey: line.customerKey,
            quantity: line.quantity.toDecimalString(),
            unitPrice: line.unitPrice.toDecimalString(),
            total: line.total.toDecimalString(),
            exchangeRate: line.exchangeRate?.toDecimalString() ?? null,
            observation: line.observation,
            noteNumber: line.noteNumber,
          })),
        );
      }
      if (sheet.summary.length > 0) {
        await executor.insert(importedSummaryRows).values(
          sheet.summary.map((row) => ({
            batchId: batch.id,
            rowNumber: row.row,
            customerName: row.customerName,
            customerKey: row.customerKey,
            paid: row.paid.toDecimalString(),
            returned: row.returned.toDecimalString(),
          })),
        );
      }
      if (sheet.issues.length > 0) {
        await executor.insert(importIssues).values(
          sheet.issues.map((issue) => ({
            batchId: batch.id,
            rowNumber: issue.row,
            code: issue.code,
            details: issue.details,
          })),
        );
      }
      return { batchId: batch.id, replaced: removed.length > 0 };
    },

    listBatches() {
      return batchesWithCounts(executor);
    },

    async findBatch(batchId) {
      const [batch] = await batchesWithCounts(executor, batchId);
      return batch;
    },

    async lines(batchId, customerKey) {
      const rows = await executor
        .select()
        .from(importedSalesLines)
        .where(
          and(
            eq(importedSalesLines.batchId, batchId),
            customerKey === undefined ? undefined : eq(importedSalesLines.customerKey, customerKey),
          ),
        )
        .orderBy(asc(importedSalesLines.rowNumber));
      return rows.map((row) => ({
        row: row.rowNumber,
        kind: row.kind,
        date: row.saleDate,
        product: row.product,
        customerName: row.customerName,
        customerKey: row.customerKey,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        total: row.total,
        exchangeRate: row.exchangeRate,
        observation: row.observation,
        noteNumber: row.noteNumber,
      }));
    },

    async summary(batchId, customerKey) {
      const rows = await executor
        .select()
        .from(importedSummaryRows)
        .where(
          and(
            eq(importedSummaryRows.batchId, batchId),
            customerKey === undefined ? undefined : eq(importedSummaryRows.customerKey, customerKey),
          ),
        )
        .orderBy(asc(importedSummaryRows.rowNumber));
      return rows.map((row) => ({
        row: row.rowNumber,
        customerName: row.customerName,
        customerKey: row.customerKey,
        paid: row.paid,
        returned: row.returned,
      }));
    },

    async markSalesConverted(batchId, { campaignId, cutoffDate, actorId }) {
      await executor
        .update(importBatches)
        .set({
          salesConvertedAt: new Date(),
          salesConvertedBy: actorId,
          salesCampaignId: campaignId,
          salesCutoffDate: cutoffDate,
        })
        .where(eq(importBatches.id, batchId));
    },

    async clearSalesConversion(batchId) {
      await executor
        .update(importBatches)
        .set({ salesConvertedAt: null, salesConvertedBy: null, salesCampaignId: null, salesCutoffDate: null })
        .where(eq(importBatches.id, batchId));
    },

    async issues(batchId) {
      const rows = await executor
        .select()
        .from(importIssues)
        .where(eq(importIssues.batchId, batchId))
        .orderBy(sql`${importIssues.rowNumber} asc nulls first`, asc(importIssues.code));
      return rows.map((row): ImportIssue => ({
        row: row.rowNumber,
        code: row.code as ImportIssueCode,
        details: row.details,
      }));
    },
  };
}

async function batchesWithCounts(executor: DbExecutor, batchId?: string): Promise<ImportBatch[]> {
  const where = batchId === undefined ? undefined : eq(importBatches.id, batchId);
  const [batches, lineCounts, issueCounts] = await Promise.all([
    executor.select().from(importBatches).where(where).orderBy(desc(importBatches.importedAt)),
    executor
      .select({
        batchId: importedSalesLines.batchId,
        lines: count(),
        customers: countDistinct(importedSalesLines.customerKey),
      })
      .from(importedSalesLines)
      .where(batchId === undefined ? undefined : eq(importedSalesLines.batchId, batchId))
      .groupBy(importedSalesLines.batchId),
    executor
      .select({ batchId: importIssues.batchId, issues: count() })
      .from(importIssues)
      .where(batchId === undefined ? undefined : eq(importIssues.batchId, batchId))
      .groupBy(importIssues.batchId),
  ]);
  const lines = new Map(lineCounts.map((row) => [row.batchId, row]));
  const issues = new Map(issueCounts.map((row) => [row.batchId, row.issues]));
  return batches.map((batch) => ({
    id: batch.id,
    fileName: batch.fileName,
    sheetName: batch.sheetName,
    campaignLabel: batch.campaignLabel === "" ? null : batch.campaignLabel,
    importedAt: batch.importedAt,
    lineCount: lines.get(batch.id)?.lines ?? 0,
    customerCount: lines.get(batch.id)?.customers ?? 0,
    issueCount: issues.get(batch.id) ?? 0,
    salesConversion:
      batch.salesConvertedAt && batch.salesCampaignId && batch.salesCutoffDate
        ? { campaignId: batch.salesCampaignId, cutoffDate: batch.salesCutoffDate, at: batch.salesConvertedAt }
        : null,
  }));
}
