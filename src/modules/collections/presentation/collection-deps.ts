import "server-only";
import { drizzleLedgerRepository } from "@/modules/receivables/infrastructure/drizzle-ledger-repository";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import { drizzleSettingsStore } from "@/shared/infrastructure/db/app-settings";
import { drizzleDocumentCounter } from "@/shared/infrastructure/db/document-counters";
import { todayInBolivia } from "@/shared/presentation/business-date";
import type { CollectionDeps } from "../application/collection-use-cases";
import type { LateInterestDeps } from "../application/late-interest";
import { collectionLookups } from "../infrastructure/collection-lookups";
import {
  drizzleChargeRepository,
  drizzleDailyRateRepository,
  drizzleOpeningBalanceRepository,
  drizzlePaymentRepository,
} from "../infrastructure/drizzle-collection-repositories";
import { drizzleLateInterestRepository } from "../infrastructure/drizzle-late-interest-repository";

/** Composition root of the module: the use cases' ports bound to Postgres. */
export function collectionDeps(executor: DbExecutor): CollectionDeps {
  return {
    payments: drizzlePaymentRepository(executor),
    charges: drizzleChargeRepository(executor),
    openingBalances: drizzleOpeningBalanceRepository(executor),
    rates: drizzleDailyRateRepository(executor),
    settings: drizzleSettingsStore(executor),
    receipts: drizzleDocumentCounter(executor, "receipt"),
    ledger: drizzleLedgerRepository(executor),
    lookups: collectionLookups(executor),
    audit: drizzleAuditTrail(executor),
    today: () => todayInBolivia(),
  };
}

/** Late-payment interest (D38): its proposals and the charges they become. */
export function lateInterestDeps(executor: DbExecutor): LateInterestDeps {
  return {
    interest: drizzleLateInterestRepository(executor),
    charges: drizzleChargeRepository(executor),
    ledger: drizzleLedgerRepository(executor),
    settings: drizzleSettingsStore(executor),
    audit: drizzleAuditTrail(executor),
    today: () => todayInBolivia(),
  };
}
