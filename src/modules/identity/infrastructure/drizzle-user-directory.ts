import { hashPassword } from "better-auth/crypto";
import { and, asc, eq } from "drizzle-orm";
import { DomainError } from "@/shared/domain/domain-error";
import { isRole } from "@/shared/domain/role";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import { violatedUniqueConstraint } from "@/shared/infrastructure/db/postgres-errors";
import type { UserDirectory, UserSummary } from "../application/ports";
import { visibleEmail } from "../domain/user-account";
import { accounts, sessions, users } from "./auth.tables";

/** Better Auth's provider id for email/username + password accounts. */
const CREDENTIAL_PROVIDER = "credential";

const FIELD_BY_CONSTRAINT: Record<string, string> = {
  users_username_unique: "username",
  users_email_unique: "email",
};

/**
 * Writes accounts the way Better Auth does (a user row plus a "credential" account with a
 * scrypt hash), so the change and its audit entry share our transaction.
 */
export function drizzleUserDirectory(executor: DbExecutor): UserDirectory {
  return {
    async create(account, temporaryPassword) {
      const passwordHash = await hashPassword(temporaryPassword);
      try {
        const [user] = await executor
          .insert(users)
          .values({ ...account, displayUsername: account.username, mustChangePassword: true })
          .returning({ id: users.id });
        if (!user) throw new Error("Insert returned no user");
        await executor.insert(accounts).values({
          accountId: user.id,
          providerId: CREDENTIAL_PROVIDER,
          userId: user.id,
          password: passwordHash,
        });
        return user;
      } catch (error) {
        let field = FIELD_BY_CONSTRAINT[violatedUniqueConstraint(error) ?? ""];
        // A placeholder email is derived from the username, so a clash on it is a repeated username.
        if (field === "email" && visibleEmail(account.email) === null) field = "username";
        if (field) throw new DomainError("DUPLICATE", { field });
        throw error;
      }
    },

    async list() {
      const rows = await executor.select().from(users).orderBy(asc(users.name));
      return rows.map(toSummary);
    },

    async findById(userId) {
      const [row] = await executor.select().from(users).where(eq(users.id, userId));
      return row ? toSummary(row) : undefined;
    },

    async updateProfile(userId, profile) {
      await executor.update(users).set(profile).where(eq(users.id, userId));
    },

    async setActive(userId, active) {
      await executor
        .update(users)
        .set({ banned: !active, banReason: active ? null : "deactivated" })
        .where(eq(users.id, userId));
      if (!active) await endSessions(executor, userId);
    },

    async setTemporaryPassword(userId, temporaryPassword) {
      await executor
        .update(accounts)
        .set({ password: await hashPassword(temporaryPassword) })
        .where(and(eq(accounts.userId, userId), eq(accounts.providerId, CREDENTIAL_PROVIDER)));
      await executor.update(users).set({ mustChangePassword: true }).where(eq(users.id, userId));
      await endSessions(executor, userId);
    },

    async clearMustChangePassword(userId) {
      await executor.update(users).set({ mustChangePassword: false }).where(eq(users.id, userId));
    },
  };
}

function endSessions(executor: DbExecutor, userId: string) {
  return executor.delete(sessions).where(eq(sessions.userId, userId));
}

function toSummary(row: typeof users.$inferSelect): UserSummary {
  if (!isRole(row.role)) {
    throw new Error(`User ${row.id} has an unknown role: ${row.role}`);
  }
  return {
    id: row.id,
    name: row.name,
    username: row.username ?? "",
    email: visibleEmail(row.email),
    role: row.role,
    active: !row.banned,
    mustChangePassword: row.mustChangePassword,
    position: row.position,
    documentId: row.documentId,
    workZoneId: row.workZoneId,
  };
}
