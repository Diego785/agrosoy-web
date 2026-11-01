import { describe, expect, it } from "vitest";
import { Quantity } from "@/shared/domain/quantity";
import {
  contentInMeasure,
  measureDelivered,
  measureOf,
  nextPresentationCodes,
  presentationCode,
  productRecord,
} from "./product";

const q = (value: string) => Quantity.parse(value);

describe("products", () => {
  it("cleans the name and derives the comparison key", () => {
    expect(productRecord("  Proan  K Rapid ", "fertilizers")).toEqual({
      name: "Proan K Rapid",
      comparisonName: "proan k rapid",
      line: "fertilizers",
    });
  });
});

describe("presentations", () => {
  it("keeps Agrosoy's codes with at least three digits", () => {
    expect(presentationCode("001")).toBe("001");
    expect(presentationCode(" 7 ")).toBe("007");
    expect(presentationCode("1234")).toBe("1234");
    expect(presentationCode("")).toBeUndefined();
    expect(presentationCode("A1")).toBeUndefined();
    expect(nextPresentationCodes(81, 2)).toEqual(["082", "083"]);
    expect(nextPresentationCodes(0, 1)).toEqual(["001"]);
  });

  it("measures liquids in liters, solids in kilos and pieces apart", () => {
    expect(measureOf("ml")).toBe("l");
    expect(measureOf("g")).toBe("kg");
    expect(measureOf("u")).toBe("u");
    expect(contentInMeasure({ content: q("250"), unit: "ml" }).toDecimalString()).toBe("0.250");
    expect(contentInMeasure({ content: q("1.5"), unit: "l" }).toDecimalString()).toBe("1.500");
  });

  it("totals the liters or kilos a line delivers", () => {
    // 12 containers of 250 ml = 3 L
    expect(
      measureDelivered({ content: q("250"), unit: "ml", saleUnit: "container" }, q("12")).toDecimalString(),
    ).toBe("3.000");
    // Sold by the liter: 200 L of a 20 L can presentation are 200 L
    expect(
      measureDelivered({ content: q("20"), unit: "l", saleUnit: "measure" }, q("200")).toDecimalString(),
    ).toBe("200.000");
    // 45 sachets of 20 g = 0.9 kg
    expect(
      measureDelivered({ content: q("20"), unit: "g", saleUnit: "container" }, q("45")).toDecimalString(),
    ).toBe("0.900");
  });

  it("rounds quantity arithmetic to the thousandth", () => {
    expect(q("1").divideBy(3).toDecimalString()).toBe("0.333");
    expect(q("0.005").multiply(q("0.1")).toDecimalString()).toBe("0.001");
    expect(() => q("1").divideBy(0)).toThrow(RangeError);
  });
});
