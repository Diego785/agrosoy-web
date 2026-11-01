"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { withTransaction, type DbExecutor } from "@/shared/infrastructure/db/client";
import type { ActionResult } from "@/shared/presentation/action-result";
import { runAction } from "@/shared/presentation/run-action";
import type { DraftNoteInput } from "../application/note-schemas";
import {
  createDraftNote,
  discardDraftNote,
  updateDraftNote,
  type NoteDeps,
} from "../application/note-use-cases";
import { drizzleNoteRepository } from "../infrastructure/drizzle-note-repository";
import { noteLookups } from "../infrastructure/note-lookups";
import { NOTES_PATH } from "./note-routes";

function deps(executor: DbExecutor): NoteDeps {
  return {
    notes: drizzleNoteRepository(executor),
    lookups: noteLookups(executor),
    audit: drizzleAuditTrail(executor),
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
