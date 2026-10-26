import { count, desc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { auditLog } from "@/shared/infrastructure/audit/audit-log.table";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import type { AuditLogReader } from "../application/ports";
import { users } from "./auth.tables";

const actorUser = alias(users, "actor_user");
const targetUser = alias(users, "target_user");

export function drizzleAuditLogReader(executor: DbExecutor): AuditLogReader {
  return {
    async page({ limit, offset }) {
      const [items, totals] = await Promise.all([
        executor
          .select({
            id: auditLog.id,
            occurredAt: auditLog.occurredAt,
            actorName: actorUser.name,
            action: auditLog.action,
            entityType: auditLog.entityType,
            // Records name themselves in their payload; users are looked up; settings use their id.
            entityLabel: sql<string | null>`coalesce(
              ${auditLog.payload} ->> 'name',
              ${auditLog.payload} ->> 'sheetName',
              ${targetUser.name},
              case when ${auditLog.entityType} = 'role' then ${auditLog.entityId} end
            )`,
          })
          .from(auditLog)
          .leftJoin(actorUser, sql`${actorUser.id}::text = ${auditLog.actorId}`)
          .leftJoin(
            targetUser,
            sql`${auditLog.entityType} = 'user' and ${targetUser.id}::text = ${auditLog.entityId}`,
          )
          .orderBy(desc(auditLog.occurredAt))
          .limit(limit)
          .offset(offset),
        executor.select({ total: count() }).from(auditLog),
      ]);
      return { items, total: totals[0]?.total ?? 0 };
    },
  };
}
