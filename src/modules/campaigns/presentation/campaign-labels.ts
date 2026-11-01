import type { Season } from "../domain/campaign";

export const SEASON_LABELS: Record<Season, string> = { summer: "Verano", winter: "Invierno" };

/** "Invierno 2026", as Agrosoy titles its spreadsheets. */
export function campaignLabel(campaign: { season: Season; year: number }): string {
  return `${SEASON_LABELS[campaign.season]} ${campaign.year}`;
}
