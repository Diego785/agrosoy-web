import "server-only";
import { drizzleLedgerRepository } from "@/modules/receivables/infrastructure/drizzle-ledger-repository";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import { drizzleDocumentCounter } from "@/shared/infrastructure/db/document-counters";
import { todayInBolivia } from "@/shared/presentation/business-date";
import type { CollectionDeps } from "../application/collection-use-cases";
import { collectionLookups } from "../infrastructure/collection-lookups";
import {
  drizzleChargeRepository,
  drizzleDailyRateRepository,
  drizzlePaymentRepository,
} from "../infrastructure/drizzle-collection-repositories";

/** Composition root of the module: the use cases' ports bound to Postgres. */
export function collectionDeps(executor: DbExecutor): CollectionDeps {
  return {
    payments: drizzlePaymentRepository(executor),
    charges: drizzleChargeRepository(executor),
    rates: drizzleDailyRateRepository(executor),
    receipts: drizzleDocumentCounter(executor, "receipt"),
    ledger: drizzleLedgerRepository(executor),
    lookups: collectionLookups(executor),
    audit: drizzleAuditTrail(executor),
    today: () => todayInBolivia(),
  };
}
