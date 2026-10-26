import { z } from "zod";
import type { Actor } from "@/shared/application/actor";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import type { AuditLogEntry, AuditLogReader } from "./ports";

export const AUDIT_PAGE_SIZE = 50;

const pageSchema = z.object({ page: z.coerce.number().int().min(1).catch(1) });

/** Who did what and when (proposal, M1: every action is recorded with user, date and time). */
export async function listAuditEntries(
  deps: { auditLog: AuditLogReader },
  actor: Actor,
  input: unknown,
): Promise<{ items: AuditLogEntry[]; total: number; page: number; pageSize: number }> {
  assertCan(actor, "audit.view");
  const { page } = validateInput(pageSchema, input);
  const result = await deps.auditLog.page({ limit: AUDIT_PAGE_SIZE, offset: (page - 1) * AUDIT_PAGE_SIZE });
  return { ...result, page, pageSize: AUDIT_PAGE_SIZE };
}
