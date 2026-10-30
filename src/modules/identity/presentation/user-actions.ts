"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { withTransaction, type DbExecutor } from "@/shared/infrastructure/db/client";
import type { ActionResult } from "@/shared/presentation/action-result";
import { runAction } from "@/shared/presentation/run-action";
import type { ChangeOwnPasswordInput, CreateUserInput, UpdateUserInput } from "../application/user-schemas";
import {
  changeOwnPassword,
  createUser,
  resetUserPassword,
  setUserActive,
  updateUser,
} from "../application/user-use-cases";
import { getAuth } from "../infrastructure/auth";
import { betterAuthOwnCredentials } from "../infrastructure/better-auth-own-credentials";
import { drizzleUserDirectory } from "../infrastructure/drizzle-user-directory";
import { randomPasswordGenerator } from "../infrastructure/random-password-generator";
import { requireActor } from "./current-user";
import { HOME_PATH, USERS_PATH } from "./identity-routes";

function userAdminDeps(executor: DbExecutor) {
  return {
    users: drizzleUserDirectory(executor),
    passwords: randomPasswordGenerator,
    audit: drizzleAuditTrail(executor),
  };
}

export async function createUserAction(
  input: CreateUserInput,
): Promise<ActionResult<{ id: string; temporaryPassword: string }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const created = await withTransaction((tx) => createUser(userAdminDeps(tx), actor, input));
    revalidatePath(USERS_PATH);
    return created;
  });
}

export async function updateUserAction(userId: string, input: UpdateUserInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => updateUser(userAdminDeps(tx), actor, userId, input));
    revalidatePath(USERS_PATH, "layout");
    return null;
  });
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => setUserActive(userAdminDeps(tx), actor, { userId }, active));
    revalidatePath(USERS_PATH);
    return null;
  });
}

export async function resetUserPasswordAction(
  userId: string,
): Promise<ActionResult<{ temporaryPassword: string }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const reset = await withTransaction((tx) => resetUserPassword(userAdminDeps(tx), actor, { userId }));
    revalidatePath(USERS_PATH);
    return reset;
  });
}

export async function changeOwnPasswordAction(input: ChangeOwnPasswordInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor({ allowPendingPasswordChange: true });
    const credentials = betterAuthOwnCredentials(getAuth(), await headers());
    await withTransaction((tx) => changeOwnPassword({ ...userAdminDeps(tx), credentials }, actor, input));
    // Every page may have redirected here while the flag was set; drop them from the router cache.
    revalidatePath(HOME_PATH, "layout");
    return null;
  });
}
