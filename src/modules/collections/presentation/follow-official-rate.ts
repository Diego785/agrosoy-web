import "server-only";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { drizzleSettingsStore } from "@/shared/infrastructure/db/app-settings";
import { getDb } from "@/shared/infrastructure/db/client";
import { followOfficialRate, type FollowResult } from "../application/official-rate";
import { dolarApiOfficialRate } from "../infrastructure/dolarapi-official-rate";
import { drizzleDailyRateRepository } from "../infrastructure/drizzle-collection-repositories";

/**
 * Brings the rate in force up to the official one when "Seguir el oficial" is on (D42), before a
 * screen reads it. Once a day at most; a failure here never stops the screen, which keeps the last rate.
 */
export async function followOfficialRateToday(today: string): Promise<FollowResult> {
  const db = getDb();
  try {
    return await followOfficialRate(
      {
        settings: drizzleSettingsStore(db),
        rates: drizzleDailyRateRepository(db),
        official: dolarApiOfficialRate,
        audit: drizzleAuditTrail(db),
      },
      today,
    );
  } catch (error) {
    console.error("Following the official rate failed", error);
    return { following: false };
  }
}
