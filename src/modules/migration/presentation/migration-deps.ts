import "server-only";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import type { ImportDeps } from "../application/import-use-cases";
import { drizzleImportRepository } from "../infrastructure/drizzle-import-repository";
import { exceljsWorkbookReader } from "../infrastructure/exceljs-workbook-reader";

/** Composition root of the module: the use cases' ports bound to Postgres and exceljs. */
export function migrationDeps(executor: DbExecutor): ImportDeps {
  return {
    imports: drizzleImportRepository(executor),
    workbooks: exceljsWorkbookReader,
    audit: drizzleAuditTrail(executor),
  };
}
