import { count, desc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { auditLog } from "@/shared/infrastructure/audit/audit-log.table";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import type { AuditLogReader } from "../application/ports";
import { customers } from "@/modules/customers/infrastructure/customers.tables";
import { users } from "./auth.tables";

const actorUser = alias(users, "actor_user");
const targetUser = alias(users, "target_user");
const targetCustomer = alias(customers, "target_customer");

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
            // Customers and users are looked up (a customer's payload may name a property or a
            // receiver); other records name themselves in their payload; settings use their id.
            entityLabel: sql<string | null>`coalesce(
              ${targetCustomer.name},
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
          .leftJoin(
            targetCustomer,
            sql`${auditLog.entityType} = 'customer' and ${targetCustomer.id}::text = ${auditLog.entityId}`,
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
