import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getEnv } from "@/shared/config/env";
import * as schema from "./schema";

export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString, max: 10 });
  return drizzle(pool, { schema, casing: "snake_case" });
}

export type Database = ReturnType<typeof createDatabase>;
/** A transaction exposes the same query API as the database, so repositories accept either. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbExecutor = Database | Transaction;

// One pool per server process; kept on globalThis so hot reloads in development don't open more.
const globalForDb = globalThis as unknown as { agrosoyDb?: Database };

export function getDb(): Database {
  globalForDb.agrosoyDb ??= createDatabase(getEnv().DATABASE_URL);
  return globalForDb.agrosoyDb;
}

/** Runs `work` in one transaction: all of its writes commit together or none do (D3). */
export function withTransaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
  return getDb().transaction(work);
}
