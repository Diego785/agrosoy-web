import { z } from "zod";
import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import { assertCan } from "@/shared/application/permissions";
import type { SettingsStore } from "@/shared/application/settings-store";
import { validateInput } from "@/shared/application/validate-input";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import type { DailyRateRepository, OfficialRateSettings, OfficialRateSource } from "./collection-ports";
import { followOfficialRateSchema } from "./collection-schemas";

/** Who records what the system does by itself, in the change log. */
export const SYSTEM_ACTOR_ID = "system";

const DEFAULTS: OfficialRateSettings = { followOfficial: false, checkedOn: null, officialDate: null };

const settingsSchema = z
  .object({
    followOfficial: z.boolean().catch(false),
    checkedOn: z.iso.date().nullable().catch(null),
    officialDate: z.iso.date().nullable().catch(null),
  })
  .catch(DEFAULTS);

export async function readOfficialRateSettings(settings: SettingsStore): Promise<OfficialRateSettings> {
  return settingsSchema.parse((await settings.get("official_rate")) ?? {});
}

/** Whether the rate in force follows the official one (D42), for Cobros. */
export async function officialRateSettings(
  deps: { settings: SettingsStore },
  actor: Actor,
): Promise<OfficialRateSettings> {
  assertCan(actor, "payments.manage");
  return readOfficialRateSettings(deps.settings);
}

/** Turns "Seguir el oficial" on or off; turning it on checks the official rate again at once. */
export async function setFollowOfficialRate(
  deps: { settings: SettingsStore; audit: AuditTrail },
  actor: Actor,
  input: unknown,
): Promise<void> {
  assertCan(actor, "payments.manage");
  const { enabled } = validateInput(followOfficialRateSchema, input);
  const current = await readOfficialRateSettings(deps.settings);
  await deps.settings.set(
    "official_rate",
    { ...current, followOfficial: enabled, checkedOn: null },
    actor.id,
  );
  await deps.audit.record({
    actorId: actor.id,
    action: enabled ? "collections.follow_official_rate" : "collections.stop_official_rate",
    entityType: "setting",
    entityId: "official_rate",
    payload: { enabled },
  });
}

/** Typing a rate means administration sets it by hand again: following the official one stops (D42). */
export async function stopFollowingOfficialRate(settings: SettingsStore, actorId: string): Promise<boolean> {
  const current = await readOfficialRateSettings(settings);
  if (!current.followOfficial) return false;
  await settings.set("official_rate", { ...current, followOfficial: false }, actorId);
  return true;
}

export type FollowResult =
  | { following: false }
  /** `officialDate` is the date of the official rate last seen; null when the service failed. */
  | { following: true; officialDate: string | null };

/**
 * With "Seguir el oficial" on, the first time the rate in force is needed each day the official rate
 * becomes the rate in force, with its own date (D42). The service is asked once a day: if it fails or
 * still shows an earlier date, the last rate stays and the result says how old the official one is.
 * Runs as the system, not as whoever opened the screen.
 */
export async function followOfficialRate(
  deps: {
    settings: SettingsStore;
    rates: DailyRateRepository;
    official: OfficialRateSource;
    audit: AuditTrail;
  },
  today: string,
): Promise<FollowResult> {
  const settings = await readOfficialRateSettings(deps.settings);
  if (!settings.followOfficial) return { following: false };
  if (settings.checkedOn === today) return { following: true, officialDate: settings.officialDate };

  const official = await deps.official.latest();
  if (official && official.date <= today) {
    const current = await deps.rates.currentOn(today);
    const rate = ExchangeRate.parse(official.rate);
    const isNewer =
      !current ||
      official.date > current.since ||
      (official.date === current.since && !ExchangeRate.parse(current.rate).equals(rate));
    if (isNewer) {
      await deps.rates.save(official.date, rate, SYSTEM_ACTOR_ID);
      await deps.audit.record({
        actorId: SYSTEM_ACTOR_ID,
        action: "collections.adopt_official_rate",
        entityType: "daily_exchange_rate",
        entityId: official.date,
        payload: { name: `${official.date}: ${rate.toDecimalString()}` },
      });
    }
  }
  const officialDate = official?.date ?? settings.officialDate;
  await deps.settings.set("official_rate", { ...settings, checkedOn: today, officialDate }, SYSTEM_ACTOR_ID);
  return { following: true, officialDate: official ? official.date : null };
}
