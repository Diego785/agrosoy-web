import "server-only";
import { getDb } from "@/shared/infrastructure/db/client";
import { todayInBolivia } from "@/shared/presentation/business-date";
import type { StatementDeps } from "../application/statement-use-cases";
import { drizzleStatementReader } from "../infrastructure/drizzle-statement-reader";

/** Composition root for statements: the ledger read from Postgres, aged at today's date in Bolivia. */
export function statementDeps(): StatementDeps {
  return { statements: drizzleStatementReader(getDb()), today: () => todayInBolivia() };
}
