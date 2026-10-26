import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { createdAt, id } from "@/shared/infrastructure/db/columns";

/** Append-only trail of every command: who did what, to which record, with which data. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    occurredAt: createdAt(),
    actorId: text().notNull(),
    action: text().notNull(),
    entityType: text().notNull(),
    /** A uuid for records; other identifiers (a role name) for settings. */
    entityId: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
  },
  (table) => [index().on(table.entityType, table.entityId), index().on(table.occurredAt)],
);
