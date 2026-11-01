import { DomainError } from "@/shared/domain/domain-error";

export const SEASONS = ["summer", "winter"] as const;
export type Season = (typeof SEASONS)[number];

/** A selling season with its own prices; every note, payment and debt belongs to one (M4). */
export type CampaignRecord = {
  season: Season;
  /** The year the campaign starts in. */
  year: number;
  /** ISO dates, both inclusive. */
  startsOn: string;
  endsOn: string;
};

export type CampaignPeriod = Pick<CampaignRecord, "startsOn" | "endsOn">;

export function campaignRecord(input: CampaignRecord): CampaignRecord {
  if (input.endsOn <= input.startsOn) {
    throw new DomainError("VALIDATION_FAILED", { fieldErrors: { endsOn: ["ends_before_start"] } });
  }
  return input;
}

/** Campaigns can't overlap: a date must point to exactly one campaign. */
export function overlaps(a: CampaignPeriod, b: CampaignPeriod): boolean {
  return a.startsOn <= b.endsOn && b.startsOn <= a.endsOn;
}

/** The campaign that ended right before this one started, whose prices are the usual start. */
export function previousCampaign<T extends CampaignPeriod & { id: string }>(
  campaigns: readonly T[],
  campaign: T,
): T | undefined {
  return campaigns
    .filter((other) => other.endsOn < campaign.startsOn)
    .reduce<T | undefined>(
      (latest, other) => (!latest || other.startsOn > latest.startsOn ? other : latest),
      undefined,
    );
}

export function campaignOn<T extends CampaignPeriod>(
  campaigns: readonly T[],
  isoDate: string,
): T | undefined {
  return campaigns.find((campaign) => campaign.startsOn <= isoDate && isoDate <= campaign.endsOn);
}
