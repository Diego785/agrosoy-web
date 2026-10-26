"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { drizzleLedgerRepository } from "@/modules/receivables/infrastructure/drizzle-ledger-repository";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { withTransaction, type DbExecutor } from "@/shared/infrastructure/db/client";
import { drizzleDocumentCounter } from "@/shared/infrastructure/db/document-counters";
import type { ActionResult } from "@/shared/presentation/action-result";
import { todayInBolivia } from "@/shared/presentation/business-date";
import { runAction } from "@/shared/presentation/run-action";
import { confirmNote, setNextNoteNumber, voidNote } from "../application/note-lifecycle";
import type {
  ConfirmNoteInput,
  DraftNoteInput,
  NextNoteNumberInput,
  VoidNoteInput,
} from "../application/note-schemas";
import { createDraftNote, discardDraftNote, updateDraftNote } from "../application/note-use-cases";
import { drizzleNoteRepository } from "../infrastructure/drizzle-note-repository";
import { noteLookups } from "../infrastructure/note-lookups";
import { NOTES_PATH } from "./note-routes";

function deps(executor: DbExecutor) {
  return {
    notes: drizzleNoteRepository(executor),
    lookups: noteLookups(executor),
    numbering: drizzleDocumentCounter(executor, "delivery_note"),
    ledger: drizzleLedgerRepository(executor),
    audit: drizzleAuditTrail(executor),
    today: todayInBolivia,
  };
}

export async function createDraftNoteAction(input: DraftNoteInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const created = await withTransaction((tx) => createDraftNote(deps(tx), actor, input));
    revalidatePath(NOTES_PATH, "layout");
    return created;
  });
}

export async function updateDraftNoteAction(
  noteId: string,
  input: DraftNoteInput,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => updateDraftNote(deps(tx), actor, noteId, input));
    revalidatePath(NOTES_PATH, "layout");
    return null;
  });
}

export async function discardDraftNoteAction(noteId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => discardDraftNote(deps(tx), actor, noteId));
    revalidatePath(NOTES_PATH, "layout");
    return null;
  });
}

export async function confirmNoteAction(
  noteId: string,
  input: ConfirmNoteInput,
): Promise<ActionResult<{ number: number }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const confirmed = await withTransaction((tx) => confirmNote(deps(tx), actor, noteId, input));
    revalidatePath(NOTES_PATH, "layout");
    return confirmed;
  });
}

export async function voidNoteAction(noteId: string, input: VoidNoteInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => voidNote(deps(tx), actor, noteId, input));
    revalidatePath(NOTES_PATH, "layout");
    return null;
  });
}

export async function setNextNoteNumberAction(input: NextNoteNumberInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => setNextNoteNumber(deps(tx), actor, input));
    revalidatePath(NOTES_PATH);
    return null;
  });
}
