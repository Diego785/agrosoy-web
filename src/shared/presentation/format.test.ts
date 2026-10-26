import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatMoney,
  formatPerMille,
  formatQuantity,
  formatRate,
  formatUsd,
  trimDecimalZeros,
} from "./format";

describe("Bolivian display formats", () => {
  it("formats money with dot thousands and comma decimals, exactly", () => {
    expect(formatMoney("34238.89")).toBe("34.238,89");
    expect(formatUsd("-0.05")).toBe("US$ -0,05");
    expect(formatMoney("90071992547409.93")).toBe("90.071.992.547.409,93");
  });

  it("drops trailing zeros from quantities and keeps rate decimals", () => {
    expect(formatQuantity("200.000")).toBe("200");
    expect(formatQuantity("2.500")).toBe("2,5");
    expect(formatRate("6.9600")).toBe("6,96");
    expect(formatRate("6.9655")).toBe("6,9655");
  });

  it("formats dates and percentages", () => {
    expect(formatDate("2026-04-30")).toBe("30/04/2026");
    expect(formatPerMille(67)).toBe("6,7 %");
  });

  it("trims decimal zeros only after the point", () => {
    expect(trimDecimalZeros("6.9600")).toBe("6.96");
    expect(trimDecimalZeros("200.000")).toBe("200");
    expect(trimDecimalZeros("100")).toBe("100");
    expect(trimDecimalZeros("10.500")).toBe("10.5");
  });
});
