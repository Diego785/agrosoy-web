import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { newUserAccount } from "../domain/user-account";
import type { OwnCredentials, PasswordGenerator, UserDirectory, UserSummary } from "./ports";
import { changeOwnPasswordSchema, createUserSchema, userIdSchema } from "./user-schemas";

export type UserAdminDeps = {
  users: UserDirectory;
  passwords: PasswordGenerator;
  audit: AuditTrail;
};

/** Administration creates every account; there is no self sign-up. */
export async function createUser(
  deps: UserAdminDeps,
  actor: Actor,
  input: unknown,
): Promise<{ id: string; temporaryPassword: string }> {
  assertCan(actor, "users.manage");
  const account = newUserAccount(validateInput(createUserSchema, input));
  const temporaryPassword = deps.passwords.generate();

  const { id } = await deps.users.create(account, temporaryPassword);
  await deps.audit.record({
    actorId: actor.id,
    action: "identity.create_user",
    entityType: "user",
    entityId: id,
    payload: account,
  });
  // Shown once to the administrator, who hands it over; it is never stored in clear text.
  return { id, temporaryPassword };
}

export async function listUsers(deps: Pick<UserAdminDeps, "users">, actor: Actor): Promise<UserSummary[]> {
  assertCan(actor, "users.manage");
  return deps.users.list();
}

export async function setUserActive(
  deps: Pick<UserAdminDeps, "users" | "audit">,
  actor: Actor,
  input: unknown,
  active: boolean,
): Promise<void> {
  assertCan(actor, "users.manage");
  const { userId } = validateInput(userIdSchema, input);
  if (!active && userId === actor.id) {
    // Prevents locking the last administrator out by accident.
    throw new DomainError("FORBIDDEN", { reason: "self_deactivation" });
  }
  await findExisting(deps.users, userId);

  await deps.users.setActive(userId, active);
  await deps.audit.record({
    actorId: actor.id,
    action: active ? "identity.reactivate_user" : "identity.deactivate_user",
    entityType: "user",
    entityId: userId,
    payload: {},
  });
}

export async function resetUserPassword(
  deps: UserAdminDeps,
  actor: Actor,
  input: unknown,
): Promise<{ temporaryPassword: string }> {
  assertCan(actor, "users.manage");
  const { userId } = validateInput(userIdSchema, input);
  await findExisting(deps.users, userId);
  const temporaryPassword = deps.passwords.generate();

  await deps.users.setTemporaryPassword(userId, temporaryPassword);
  await deps.audit.record({
    actorId: actor.id,
    action: "identity.reset_password",
    entityType: "user",
    entityId: userId,
    payload: {},
  });
  return { temporaryPassword };
}

/** Any signed-in user can change their own password; it also clears the temporary-password flag. */
export async function changeOwnPassword(
  deps: { users: UserDirectory; credentials: OwnCredentials; audit: AuditTrail },
  actor: Actor,
  input: unknown,
): Promise<void> {
  const { currentPassword, newPassword } = validateInput(changeOwnPasswordSchema, input);

  await deps.credentials.changePassword(currentPassword, newPassword);
  await deps.users.clearMustChangePassword(actor.id);
  await deps.audit.record({
    actorId: actor.id,
    action: "identity.change_own_password",
    entityType: "user",
    entityId: actor.id,
    payload: {},
  });
}

async function findExisting(users: UserDirectory, userId: string): Promise<UserSummary> {
  const user = await users.findById(userId);
  if (!user) throw new DomainError("NOT_FOUND", { entity: "user", userId });
  return user;
}
