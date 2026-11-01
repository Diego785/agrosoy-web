import { formatQuantity } from "@/shared/presentation/format";
import type { PresentationView } from "../application/catalog-ports";
import type { ContentUnit, ProductLine, SaleUnit } from "../domain/product";
import { measureOf } from "../domain/product";

export const LINE_LABELS: Record<ProductLine, string> = {
  agrochemicals: "Agroquímicos",
  fertilizers: "Fertilizantes",
};

export const UNIT_LABELS: Record<ContentUnit, string> = { l: "L", ml: "ml", kg: "kg", g: "g", u: "unid." };

export const SALE_UNIT_LABELS: Record<SaleUnit, string> = {
  container: "por envase",
  measure: "por litro, kilo o unidad",
};

/** "20 L" */
export function contentLabel(presentation: Pick<PresentationView, "content" | "unit">): string {
  return `${formatQuantity(presentation.content)} ${UNIT_LABELS[presentation.unit]}`;
}

const MEASURE_LABELS = { l: "litro", kg: "kilo", u: "unidad" } as const;

/** What one unit of the price is: "envase", "litro", "kilo" or "unidad". */
export function priceUnitLabel(presentation: Pick<PresentationView, "unit" | "saleUnit">): string {
  return presentation.saleUnit === "container" ? "envase" : MEASURE_LABELS[measureOf(presentation.unit)];
}

const MEASURE_PLURALS = { l: "litros", kg: "kilos", u: "unidades" } as const;

/** What a note line's quantity counts: "envases", "litros", "kilos" or "unidades". */
export function quantityUnitLabel(presentation: Pick<PresentationView, "unit" | "saleUnit">): string {
  return presentation.saleUnit === "container" ? "envases" : MEASURE_PLURALS[measureOf(presentation.unit)];
}

/** "001 · Fulvin 40-22 · 20 L", how notes and price sheets name a presentation. */
export function presentationLabel(
  productName: string,
  presentation: Pick<PresentationView, "code" | "content" | "unit">,
): string {
  return `${presentation.code} · ${productName} · ${contentLabel(presentation)}`;
}
