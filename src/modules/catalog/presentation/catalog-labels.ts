import { formatQuantity } from "@/shared/presentation/format";
import type { PresentationView } from "../application/catalog-ports";
import type { ContentUnit, ProductLine, SaleUnit } from "../domain/product";
import { measureOf } from "../domain/product";

export const LINE_LABELS: Record<ProductLine, string> = {
  agrochemicals: "Agroquímicos",
  fertilizers: "Fertilizantes",
};

export const UNIT_LABELS: Record<ContentUnit, string> = { l: "L", ml: "ml", kg: "kg", g: "g" };

export const SALE_UNIT_LABELS: Record<SaleUnit, string> = {
  container: "por envase",
  measure: "por litro o kilo",
};

/** "20 L" */
export function contentLabel(presentation: Pick<PresentationView, "content" | "unit">): string {
  return `${formatQuantity(presentation.content)} ${UNIT_LABELS[presentation.unit]}`;
}

/** What one unit of the price is: "envase", "litro" or "kilo". */
export function priceUnitLabel(presentation: Pick<PresentationView, "unit" | "saleUnit">): string {
  if (presentation.saleUnit === "container") return "envase";
  return measureOf(presentation.unit) === "l" ? "litro" : "kilo";
}
