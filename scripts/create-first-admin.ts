// Creates the first administrator of an empty installation and prints a temporary password.
// Every later user is created from the Usuarios page.
//
//   corepack pnpm users:first-admin --name "Liz …" --username liz [--email liz@…]
//   (in the container: node create-first-admin.mjs --name … --username …)
import { parseArgs } from "node:util";
import { config } from "dotenv";
import { count } from "drizzle-orm";
import { drizzleZoneRepository } from "@/modules/customers/infrastructure/drizzle-zone-repository";
import { createUser } from "@/modules/identity/application/user-use-cases";
import { users } from "@/modules/identity/infrastructure/auth.tables";
import { drizzleUserDirectory } from "@/modules/identity/infrastructure/drizzle-user-directory";
import { randomPasswordGenerator } from "@/modules/identity/infrastructure/random-password-generator";
import type { Actor } from "@/shared/application/actor";
import { effectivePermissions } from "@/shared/application/permissions";
import { isDomainError } from "@/shared/domain/domain-error";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { createDatabase } from "@/shared/infrastructure/db/client";

config({ path: ".env.local", quiet: true });

/** Recorded in the audit log as the author of the first account. */
const INSTALLER: Actor = {
  id: "00000000-0000-0000-0000-000000000000",
  name: "Instalación",
  role: "admin",
  permissions: effectivePermissions("admin", []),
};

async function main() {
  const { values } = parseArgs({
    options: { name: { type: "string" }, username: { type: "string" }, email: { type: "string" } },
  });
  if (!values.name || !values.username) {
    throw new Error('Usage: --name "Full Name" --username user [--email user@example.com]');
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const db = createDatabase(url);
  try {
    const [existing] = await db.select({ total: count() }).from(users);
    if ((existing?.total ?? 0) > 0) {
      throw new Error("Users already exist; create new ones from the Usuarios page.");
    }
    const { temporaryPassword } = await db.transaction((tx) =>
      createUser(
        {
          users: drizzleUserDirectory(tx),
          passwords: randomPasswordGenerator,
          audit: drizzleAuditTrail(tx),
          zones: drizzleZoneRepository(tx),
        },
        INSTALLER,
        { name: values.name, username: values.username, email: values.email, role: "admin" },
      ),
    );
    console.log(
      `Administrator created.\n  Username: ${values.username.toLowerCase()}\n  Temporary password: ${temporaryPassword}`,
    );
    console.log("It must be changed at the first sign-in.");
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  const message = isDomainError(error)
    ? `${error.code}: ${JSON.stringify(error.details)}`
    : error instanceof Error
      ? error.message
      : error;
  console.error(message);
  process.exit(1);
});
