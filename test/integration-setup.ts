import { sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import { testDb } from "./test-database";

// Each test starts from empty tables. Migrations live in the "drizzle" schema and are kept.
beforeEach(async () => {
  const { rows } = await testDb.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  if (rows.length === 0) return;
  const tables = rows.map(({ tablename }) => `"${tablename}"`).join(", ");
  await testDb.execute(sql.raw(`truncate ${tables} restart identity cascade`));
});

afterAll(async () => {
  await testDb.$client.end();
});
