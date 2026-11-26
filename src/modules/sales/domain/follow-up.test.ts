import { describe, expect, it } from "vitest";
import { Quantity } from "@/shared/domain/quantity";
import { UnitPrice } from "@/shared/domain/unit-price";
import { returnLines, shared, transferLines, type OriginalLine } from "./follow-up";

const original: OriginalLine[] = [
  {
    id: "fulvin",
    presentationId: "p1",
    quantity: Quantity.parse("200"),
    unitPrice: UnitPrice.parse("11"),
    freeOfCharge: null,
    settled: Quantity.parse("40"),
  },
  {
    id: "sample",
    presentationId: "p2",
    quantity: Quantity.parse("2"),
    unitPrice: UnitPrice.zero(),
    freeOfCharge: "sample",
    settled: Quantity.zero(),
  },
];
const ask = (originalLineId: string, quantity: string) => ({
  originalLineId,
  quantity: Quantity.parse(quantity),
});
const totals = (lines: ReturnType<typeof returnLines>) =>
  lines.map((line) => [
    line.originalLineId,
    line.total.toDecimalString(),
    line.originalTotal.toDecimalString(),
  ]);

describe("returns", () => {
  it("credit each line at its delivered price, up to what is left of it", () => {
    expect(totals(returnLines(original, [ask("fulvin", "160"), ask("sample", "1")]))).toEqual([
      ["fulvin", "1760.00", "1760.00"],
      ["sample", "0.00", "0.00"],
    ]);
  });

  it("reject more than is left and requests with nothing to return", () => {
    expect(() => returnLines(original, [ask("fulvin", "160.001")])).toThrow("VALIDATION_FAILED");
    expect(() => returnLines(original, [ask("fulvin", "0")])).toThrow("VALIDATION_FAILED");
    expect(() => returnLines(original, [ask("other", "1")])).toThrow("VALIDATION_FAILED");
  });
});

describe("campaign transfers", () => {
  it("charge the new price and credit the old one", () => {
    const [line] = transferLines(original, [{ ...ask("fulvin", "100"), unitPrice: UnitPrice.parse("12.5") }]);
    expect(line?.total.toDecimalString()).toBe("1250.00");
    expect(line?.originalTotal.toDecimalString()).toBe("1100.00");
  });

  it("need a new price and leave free products out", () => {
    expect(() => transferLines(original, [{ ...ask("fulvin", "1"), unitPrice: UnitPrice.zero() }])).toThrow(
      "INVALID_AMOUNT",
    );
    expect(() =>
      transferLines(original, [{ ...ask("sample", "1"), unitPrice: UnitPrice.parse("1") }]),
    ).toThrow("VALIDATION_FAILED");
  });
});

describe("what the sources of a follow-up share (D25)", () => {
  it("is the value they all have, or null when they differ or there are none", () => {
    expect(shared(["p1", "p1"])).toBe("p1");
    expect(shared(["p1", "p2"])).toBeNull();
    expect(shared([null, null])).toBeNull();
    expect(shared([])).toBeNull();
  });
});
