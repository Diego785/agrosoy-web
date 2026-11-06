import { z } from "zod";
import type { Actor } from "@/shared/application/actor";
import { paged, pageWindow, pagingFields, type Paged } from "@/shared/application/pagination";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import type { AuditLogEntry, AuditLogReader } from "./ports";

const pageSchema = z.object(pagingFields);

/** Who did what and when (proposal, M1: every action is recorded with user, date and time). */
export async function listAuditEntries(
  deps: { auditLog: AuditLogReader },
  actor: Actor,
  input: unknown,
): Promise<Paged<AuditLogEntry>> {
  assertCan(actor, "audit.view");
  const paging = validateInput(pageSchema, input);
  return paged(paging, await deps.auditLog.page(pageWindow(paging)));
}
