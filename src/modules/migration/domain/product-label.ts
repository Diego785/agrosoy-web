import { cleanText, normalizeForComparison } from "@/shared/domain/text";

export type ParsedProductLabel = {
  name: string;
  /** Comparison key of the name: "Proan K Rapid" and "Proan k rapid" are one product. */
  key: string;
  /** Decimal string, "1.5" */
  content: string;
  unit: "l" | "ml" | "kg" | "g";
};

const UNITS: Record<string, ParsedProductLabel["unit"]> = {
  l: "l",
  lt: "l",
  lts: "l",
  litro: "l",
  litros: "l",
  ml: "ml",
  cc: "ml",
  kg: "kg",
  kgs: "kg",
  kilo: "kg",
  kilos: "kg",
  g: "g",
  gr: "g",
  grs: "g",
  gramos: "g",
};

const LABEL = /^(.*?)\s*\(\s*(\d+(?:[.,]\d+)?)\s*([a-zñ]+)\.?\s*\)\s*$/i;

/**
 * The spreadsheets write the presentation in brackets after the name: "Fulvin 40-22(20lts.)",
 * "4-energy(250ml.)", "Soja Siembra plus(1,5lts.)". Returns undefined when it can't tell.
 */
export function parseProductLabel(label: string): ParsedProductLabel | undefined {
  const match = LABEL.exec(cleanText(label));
  if (!match) return undefined;
  const [, rawName = "", rawContent = "", rawUnit = ""] = match;
  const unit = UNITS[rawUnit.toLowerCase()];
  const name = cleanText(rawName);
  if (!unit || !name) return undefined;
  const content = rawContent.replace(",", ".");
  return { name, key: normalizeForComparison(name), content: String(Number(content)), unit };
}
