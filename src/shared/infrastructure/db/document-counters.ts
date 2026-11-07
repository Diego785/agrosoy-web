import { eq, sql } from "drizzle-orm";
import { check, integer, pgTable, text } from "drizzle-orm/pg-core";
import type { DocumentCounter } from "@/shared/application/document-counter";
import type { DbExecutor } from "./client";
import { timestamps } from "./columns";

export const DOCUMENT_COUNTER_KEYS = ["delivery_note", "receipt"] as const;
export type DocumentCounterKey = (typeof DOCUMENT_COUNTER_KEYS)[number];

export const documentCounters = pgTable(
  "document_counters",
  {
    key: text({ enum: DOCUMENT_COUNTER_KEYS }).primaryKey(),
    nextNumber: integer().notNull(),
    ...timestamps,
  },
  (table) => [check("document_counters_next_number_positive", sql`${table.nextNumber} > 0`)],
);

export function drizzleDocumentCounter(executor: DbExecutor, key: DocumentCounterKey): DocumentCounter {
  async function firstFree(from: number, isTaken: (number: number) => Promise<boolean>) {
    let number = from;
    while (await isTaken(number)) number += 1;
    return number;
  }

  const select = () =>
    executor
      .select({ nextNumber: documentCounters.nextNumber })
      .from(documentCounters)
      .where(eq(documentCounters.key, key));

  return {
    async take(isTaken) {
      await executor.insert(documentCounters).values({ key, nextNumber: 1 }).onConflictDoNothing();
      // The row lock is what keeps two confirmations from taking the same number.
      const [row] = await select().for("update");
      if (!row) throw new Error(`Document counter ${key} is missing`);
      const number = await firstFree(row.nextNumber, isTaken);
      await executor
        .update(documentCounters)
        .set({ nextNumber: number + 1 })
        .where(eq(documentCounters.key, key));
      return number;
    },

    async peek(isTaken) {
      const [row] = await select();
      return firstFree(row?.nextNumber ?? 1, isTaken);
    },

    async set(next) {
      await executor
        .insert(documentCounters)
        .values({ key, nextNumber: next })
        .onConflictDoUpdate({ target: documentCounters.key, set: { nextNumber: next } });
    },
  };
}
