import type { AuditTrail } from "@/shared/application/audit-trail";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import { auditLog } from "./audit-log.table";

/** Pass the use case's transaction so the audit entry commits or rolls back with the change. */
export function drizzleAuditTrail(executor: DbExecutor): AuditTrail {
  return {
    async record(entry) {
      await executor.insert(auditLog).values(entry);
    },
  };
}
