import { connection } from "next/server";
import { isDatabaseReachable } from "@/shared/infrastructure/db/health";

/** Liveness and readiness probe for Docker and uptime monitoring. */
export async function GET() {
  // Never prerendered: the answer must reflect the database right now.
  await connection();
  const database = await isDatabaseReachable();
  return Response.json(
    { status: database ? "ok" : "degraded", database },
    { status: database ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
