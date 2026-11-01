import { Quantity } from "@/shared/domain/quantity";
import { cleanText, normalizeForComparison } from "@/shared/domain/text";

/** "Ventas sin agroquímicos" in the technicians' reports needs every product's line. */
export const PRODUCT_LINES = ["agrochemicals", "fertilizers"] as const;
export type ProductLine = (typeof PRODUCT_LINES)[number];

/** "u" counts pieces: a bag of 50 sheets of water-sensitive paper (D23). */
export const CONTENT_UNITS = ["l", "ml", "kg", "g", "u"] as const;
export type ContentUnit = (typeof CONTENT_UNITS)[number];

/** Whether the price is per container (a 20 L can) or per liter / kilo (or piece) of product. */
export const SALE_UNITS = ["container", "measure"] as const;
export type SaleUnit = (typeof SALE_UNITS)[number];

export type ProductRecord = { name: string; comparisonName: string; line: ProductLine };

export type PresentationRecord = { code: string; content: Quantity; unit: ContentUnit; saleUnit: SaleUnit };

export function productRecord(name: string, line: ProductLine): ProductRecord {
  const cleaned = cleanText(name);
  return { name: cleaned, comparisonName: normalizeForComparison(cleaned), line };
}

/**
 * Liters for liquids, kilos for solids: the measure reports and totals are given in. Pieces ("u")
 * are counted as they are and stay out of the liter and kilo totals.
 */
export function measureOf(unit: ContentUnit): "l" | "kg" | "u" {
  if (unit === "l" || unit === "ml") return "l";
  return unit === "u" ? "u" : "kg";
}

/**
 * Agrosoil's codes identify a presentation and have three or more digits ("001" is Fulvin 40-22 in
 * 20 L, D23). Shorter ones are padded, so "7" and "007" are the same code.
 */
export function presentationCode(raw: string): string | undefined {
  const digits = raw.trim();
  return /^\d{1,6}$/.test(digits) ? digits.padStart(3, "0") : undefined;
}

/** The numbers after the highest code in use, for presentations created without one. */
export function nextPresentationCodes(highest: number, count: number): string[] {
  return Array.from({ length: count }, (_, index) => String(highest + index + 1).padStart(3, "0"));
}

/** Content of one container in liters or kilos: 250 ml is 0.250 L. */
export function contentInMeasure(presentation: Pick<PresentationRecord, "content" | "unit">): Quantity {
  const { content, unit } = presentation;
  return unit === "ml" || unit === "g" ? content.divideBy(1000) : content;
}

/**
 * Liters or kilos delivered by a note line. The quantity is counted in the presentation's sale
 * unit: containers, or liters/kilos directly.
 */
export function measureDelivered(
  presentation: Omit<PresentationRecord, "code">,
  quantity: Quantity,
): Quantity {
  return presentation.saleUnit === "measure" ? quantity : quantity.multiply(contentInMeasure(presentation));
}
