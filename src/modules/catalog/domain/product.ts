import { Quantity } from "@/shared/domain/quantity";
import { cleanText, normalizeForComparison } from "@/shared/domain/text";

/** "Ventas sin agroquímicos" in the technicians' reports needs every product's line. */
export const PRODUCT_LINES = ["agrochemicals", "fertilizers"] as const;
export type ProductLine = (typeof PRODUCT_LINES)[number];

export const CONTENT_UNITS = ["l", "ml", "kg", "g"] as const;
export type ContentUnit = (typeof CONTENT_UNITS)[number];

/** Whether the price is per container (a 20 L can) or per liter / kilo of product. */
export const SALE_UNITS = ["container", "measure"] as const;
export type SaleUnit = (typeof SALE_UNITS)[number];

export type ProductRecord = { name: string; comparisonName: string; line: ProductLine };

export type PresentationRecord = { content: Quantity; unit: ContentUnit; saleUnit: SaleUnit };

export function productRecord(name: string, line: ProductLine): ProductRecord {
  const cleaned = cleanText(name);
  return { name: cleaned, comparisonName: normalizeForComparison(cleaned), line };
}

/** Liters for liquids, kilos for solids: the measure reports and totals are given in. */
export function measureOf(unit: ContentUnit): "l" | "kg" {
  return unit === "l" || unit === "ml" ? "l" : "kg";
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
export function measureDelivered(presentation: PresentationRecord, quantity: Quantity): Quantity {
  return presentation.saleUnit === "measure" ? quantity : quantity.multiply(contentInMeasure(presentation));
}
