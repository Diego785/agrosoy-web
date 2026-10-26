import { cleanText, normalizeForComparison } from "@/shared/domain/text";

/** A sales zone, e.g. Cuatro Cañadas. Zones are configured by administration. */
export type ZoneRecord = { name: string; comparisonName: string };

export function zoneRecord(name: string): ZoneRecord {
  const cleaned = cleanText(name);
  return { name: cleaned, comparisonName: normalizeForComparison(cleaned) };
}
