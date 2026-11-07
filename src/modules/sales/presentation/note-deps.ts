import "server-only";
import { drizzlePaymentRepository } from "@/modules/collections/infrastructure/drizzle-collection-repositories";
import { drizzleLedgerRepository } from "@/modules/receivables/infrastructure/drizzle-ledger-repository";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import { drizzleDocumentCounter } from "@/shared/infrastructure/db/document-counters";
import { todayInBolivia } from "@/shared/presentation/business-date";
import type { NoteLifecycleDeps } from "../application/note-lifecycle";
import type { NoteDeps } from "../application/note-use-cases";
import { drizzleNoteRepository } from "../infrastructure/drizzle-note-repository";
import { noteLookups } from "../infrastructure/note-lookups";

/** Composition root of the module: the use cases' ports bound to Postgres. */
export function noteDeps(executor: DbExecutor): NoteDeps & NoteLifecycleDeps {
  return {
    notes: drizzleNoteRepository(executor),
    lookups: noteLookups(executor),
    numbering: drizzleDocumentCounter(executor, "delivery_note"),
    ledger: drizzleLedgerRepository(executor),
    payments: drizzlePaymentRepository(executor),
    receipts: drizzleDocumentCounter(executor, "receipt"),
    audit: drizzleAuditTrail(executor),
    today: () => todayInBolivia(),
  };
}
