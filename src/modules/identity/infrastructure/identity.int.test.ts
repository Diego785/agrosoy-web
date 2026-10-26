import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { testDb } from "@test/test-database";
import { auditLog } from "@/shared/infrastructure/audit/audit-log.table";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import type { Actor } from "@/shared/application/actor";
import {
  changeOwnPassword,
  createUser,
  listUsers,
  resetUserPassword,
  setUserActive,
} from "../application/user-use-cases";
import { createAuth } from "./auth";
import { sessions } from "./auth.tables";
import { betterAuthOwnCredentials } from "./better-auth-own-credentials";
import { drizzleUserDirectory } from "./drizzle-user-directory";
import { randomPasswordGenerator } from "./random-password-generator";

const auth = createAuth(
  testDb,
  { secret: "integration-test-secret-0123456789abcdef", baseURL: "http://localhost:3000" },
  { withNextCookies: false },
);

const admin = actorWithRole("admin");

function inTransaction<T>(work: (deps: ReturnType<typeof depsFor>) => Promise<T>): Promise<T> {
  return testDb.transaction((tx) => work(depsFor(tx)));
}

function depsFor(executor: Parameters<typeof drizzleUserDirectory>[0]) {
  return {
    users: drizzleUserDirectory(executor),
    passwords: randomPasswordGenerator,
    audit: drizzleAuditTrail(executor),
  };
}

function create(input: object, actor: Actor = admin) {
  return inTransaction((deps) => createUser(deps, actor, input));
}

/** Signs in like the login form does and returns the cookie header of the new session. */
async function signIn(username: string, password: string) {
  const { headers, response } = await auth.api.signInUsername({
    body: { username, password },
    returnHeaders: true,
  });
  const cookie = headers.get("set-cookie")?.split(";")[0] ?? "";
  return { user: response?.user, cookie: new Headers({ cookie }) };
}

describe("user administration", () => {
  it("creates a user who can sign in with the temporary password", async () => {
    const { id, temporaryPassword } = await create({
      name: "Favio Añez",
      username: "FAnez",
      role: "sales_technician",
    });

    const { user } = await signIn("fanez", temporaryPassword);
    expect(user).toMatchObject({
      id,
      name: "Favio Añez",
      role: "sales_technician",
      mustChangePassword: true,
    });

    const [entry] = await testDb.select().from(auditLog);
    expect(entry).toMatchObject({ action: "identity.create_user", entityId: id, actorId: admin.id });
    expect(JSON.stringify(entry?.payload)).not.toContain(temporaryPassword);
  });

  it("rejects a repeated username, ignoring case", async () => {
    await create({ name: "Liz", username: "liz", role: "admin" });
    await expect(create({ name: "Otra Liz", username: "LIZ", role: "manager" })).rejects.toMatchObject({
      code: "DUPLICATE",
      details: { field: "username" },
    });
  });

  it("rejects a real email that another user already has", async () => {
    await create({ name: "Liz", username: "liz", email: "liz@agrosoy.com", role: "admin" });
    await expect(
      create({ name: "Liz Dos", username: "liz2", email: "LIZ@agrosoy.com", role: "manager" }),
    ).rejects.toMatchObject({ code: "DUPLICATE", details: { field: "email" } });
  });

  it("only lets administration and management manage users", async () => {
    await expect(
      create({ name: "Nadie", username: "nadie", role: "admin" }, actorWithRole("sales_technician")),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      inTransaction((deps) => listUsers(deps, actorWithRole("warehouse_keeper"))),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      create({ name: "Gerencia", username: "gerente", role: "manager" }, actorWithRole("manager")),
    ).resolves.toMatchObject({ id: expect.any(String) });
  });

  it("deactivating ends open sessions and blocks sign-in until reactivated", async () => {
    const { id, temporaryPassword } = await create({
      name: "Almacén Norte",
      username: "norte",
      role: "warehouse_keeper",
    });
    await signIn("norte", temporaryPassword);
    expect(await testDb.$count(sessions, eq(sessions.userId, id))).toBe(1);

    await inTransaction((deps) => setUserActive(deps, admin, { userId: id }, false));
    expect(await testDb.$count(sessions, eq(sessions.userId, id))).toBe(0);
    await expect(signIn("norte", temporaryPassword)).rejects.toThrow();

    await inTransaction((deps) => setUserActive(deps, admin, { userId: id }, true));
    await expect(signIn("norte", temporaryPassword)).resolves.toMatchObject({ user: { id } });
  });

  it("does not let users deactivate themselves", async () => {
    const { id } = await create({ name: "Liz", username: "liz", role: "admin" });
    const liz: Actor = { id, name: "Liz", role: "admin" };
    await expect(
      inTransaction((deps) => setUserActive(deps, liz, { userId: id }, false)),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("reports a missing user", async () => {
    await expect(
      inTransaction((deps) => resetUserPassword(deps, admin, { userId: crypto.randomUUID() })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("resetting a password replaces the old one and asks for a change", async () => {
    const { id, temporaryPassword } = await create({ name: "Liz", username: "liz", role: "admin" });
    const { temporaryPassword: newPassword } = await inTransaction((deps) =>
      resetUserPassword(deps, admin, { userId: id }),
    );

    await expect(signIn("liz", temporaryPassword)).rejects.toThrow();
    await expect(signIn("liz", newPassword)).resolves.toMatchObject({ user: { mustChangePassword: true } });
  });
});

describe("changing your own password", () => {
  async function signedInUser() {
    const { id, temporaryPassword } = await create({ name: "Liz", username: "liz", role: "admin" });
    const { cookie } = await signIn("liz", temporaryPassword);
    const actor: Actor = { id, name: "Liz", role: "admin" };
    const change = (input: object) =>
      inTransaction((deps) =>
        changeOwnPassword({ ...deps, credentials: betterAuthOwnCredentials(auth, cookie) }, actor, input),
      );
    return { temporaryPassword, change };
  }

  it("needs the current password", async () => {
    const { change } = await signedInUser();
    await expect(
      change({
        currentPassword: "wrong-password",
        newPassword: "nueva-clave-1",
        confirmation: "nueva-clave-1",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("replaces the password and clears the temporary-password flag", async () => {
    const { temporaryPassword, change } = await signedInUser();
    await change({
      currentPassword: temporaryPassword,
      newPassword: "nueva-clave-1",
      confirmation: "nueva-clave-1",
    });

    await expect(signIn("liz", temporaryPassword)).rejects.toThrow();
    await expect(signIn("liz", "nueva-clave-1")).resolves.toMatchObject({
      user: { mustChangePassword: false },
    });
  });

  it("checks the confirmation before calling anything", async () => {
    const { temporaryPassword, change } = await signedInUser();
    await expect(
      change({ currentPassword: temporaryPassword, newPassword: "nueva-clave-1", confirmation: "otra" }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { confirmation: expect.any(Array) } },
    });
  });
});
