/** Trims and collapses repeated spaces: "  Juan   Pérez " is stored as "Juan Pérez". */
export function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Cleaned text, or undefined when nothing but spaces was typed (for optional fields). */
export function optionalText(value: string | undefined): string | undefined {
  const cleaned = value === undefined ? "" : cleanText(value);
  return cleaned === "" ? undefined : cleaned;
}

const DECOMPOSED_ENYE = /ñ/g;

/**
 * Comparison key for names typed by hand: case, accents and spacing are ignored, so
 * "Proan K Rapid" and "proan  k rápid" are the same name. The ñ is kept, because
 * "Peña" and "Pena" are different surnames.
 */
export function normalizeForComparison(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(DECOMPOSED_ENYE, "ñ")
    .replace(/\p{Diacritic}/gu, "");
}
