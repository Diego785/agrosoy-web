import { and, asc, eq, sql, sum } from "drizzle-orm";
import { Money } from "@/shared/domain/money";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import type { LedgerRepository } from "../application/ledger-ports";
import { ledgerEntries } from "./ledger.tables";

export function drizzleLedgerRepository(executor: DbExecutor): LedgerRepository {
  return {
    async append(postings, createdBy) {
      await executor.insert(ledgerEntries).values(
        postings.map((entry) => ({
          customerId: entry.customerId,
          campaignId: entry.campaignId,
          entryDate: entry.date,
          kind: entry.kind,
          amount: entry.amount.toDecimalString(),
          sourceType: entry.source.type,
          sourceId: entry.source.id,
          reversesEntryId: entry.reversesEntryId,
          createdBy,
        })),
      );
    },

    async customerBalance(customerId) {
      const [row] = await executor
        .select({ balance: sql<string>`coalesce(${sum(ledgerEntries.amount)}, 0)::numeric(14,2)::text` })
        .from(ledgerEntries)
        .where(eq(ledgerEntries.customerId, customerId));
      return Money.parse(row?.balance ?? "0");
    },

    async entriesOf(source) {
      const rows = await executor
        .select()
        .from(ledgerEntries)
        .where(and(eq(ledgerEntries.sourceType, source.type), eq(ledgerEntries.sourceId, source.id)))
        .orderBy(asc(ledgerEntries.createdAt));
      return rows.map((row) => ({
        id: row.id,
        customerId: row.customerId,
        campaignId: row.campaignId,
        date: row.entryDate,
        kind: row.kind,
        amount: Money.parse(row.amount),
        source: { type: row.sourceType, id: row.sourceId },
        reversesEntryId: row.reversesEntryId,
      }));
    },
  };
}
