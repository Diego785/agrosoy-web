import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { testDatabaseUrl } from "./test-database-url";

/** Brings the test database to the latest migration once per run. */
export default async function setup() {
  const db = drizzle(testDatabaseUrl());
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
  } finally {
    await db.$client.end();
  }
}
