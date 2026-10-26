import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "./client";

/** True when the database answers a trivial query; used by the container health check. */
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await getDb().execute(sql`select 1`);
    return true;
  } catch (error) {
    console.error("Database health check failed", error);
    return false;
  }
}
