import { describe, expect, it } from "vitest";
import { cleanText, normalizeForComparison, optionalText } from "./text";

describe("cleanText", () => {
  it("trims and collapses spaces", () => {
    expect(cleanText("  Juan   Pérez ")).toBe("Juan Pérez");
  });
});

describe("optionalText", () => {
  it("turns blank input into undefined", () => {
    expect(optionalText("   ")).toBeUndefined();
    expect(optionalText(undefined)).toBeUndefined();
    expect(optionalText(" Cuatro  Cañadas ")).toBe("Cuatro Cañadas");
  });
});

describe("normalizeForComparison", () => {
  it("treats names that differ only in case, accents or spacing as equal", () => {
    expect(normalizeForComparison("Proan K Rapid")).toBe(normalizeForComparison("proan  k rápid"));
    expect(normalizeForComparison("JOSÉ  Añez")).toBe("jose añez");
  });

  it("keeps the ñ", () => {
    expect(normalizeForComparison("Peña")).not.toBe(normalizeForComparison("Pena"));
    // The same ñ typed precomposed or decomposed compares equal.
    expect(normalizeForComparison("Peña")).toBe(normalizeForComparison("Peña"));
  });
});
