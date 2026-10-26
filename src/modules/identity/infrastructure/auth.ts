import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";
import { getEnv } from "@/shared/config/env";
import { getDb, type Database } from "@/shared/infrastructure/db/client";
import { MIN_PASSWORD_LENGTH } from "../domain/user-account";
import { accounts, sessions, users, verifications } from "./auth.tables";

const HOUR = 60 * 60;

// Better Auth's own admin endpoints: administration and management may manage users, the
// other roles may not. Business permissions live in shared/application/permissions.ts.
const accessControl = createAccessControl(defaultStatements);
const authRoles = {
  admin: accessControl.newRole(adminAc.statements),
  manager: accessControl.newRole(adminAc.statements),
  sales_technician: accessControl.newRole(userAc.statements),
  warehouse_keeper: accessControl.newRole(userAc.statements),
};

/**
 * Better Auth setup (docs/decisions.md, D8). A factory so tests can point it at their database;
 * they turn off `nextCookies`, which only works inside a Next.js request.
 */
export function createAuth(
  db: Database,
  config: { secret: string; baseURL: string },
  { withNextCookies = true }: { withNextCookies?: boolean } = {},
) {
  return betterAuth({
    appName: "Agrosoy",
    secret: config.secret,
    baseURL: config.baseURL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),
    advanced: { database: { generateId: "uuid" } },
    // Administration creates every account (identity/application/user-use-cases.ts).
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: MIN_PASSWORD_LENGTH },
    // Signed out after 8 hours without activity; an active session is extended every 30 minutes.
    session: { expiresIn: 8 * HOUR, updateAge: HOUR / 2 },
    user: {
      additionalFields: {
        mustChangePassword: { type: "boolean", required: false, defaultValue: false, input: false },
      },
    },
    plugins: [
      username(),
      admin({
        ac: accessControl,
        roles: authRoles,
        defaultRole: "sales_technician",
        adminRoles: ["admin", "manager"],
      }),
      // Lets server actions set the session cookie; must stay the last plugin.
      ...(withNextCookies ? [nextCookies()] : []),
    ],
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { agrosoyAuth?: Auth };

export function getAuth(): Auth {
  const env = getEnv();
  globalForAuth.agrosoyAuth ??= createAuth(getDb(), {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
  });
  return globalForAuth.agrosoyAuth;
}
