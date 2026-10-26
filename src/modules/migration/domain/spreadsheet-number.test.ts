import { describe, expect, it } from "vitest";
import { spreadsheetNumberToDecimal } from "./spreadsheet-number";

describe("spreadsheetNumberToDecimal", () => {
  it("recovers what was typed despite binary floats", () => {
    expect(spreadsheetNumberToDecimal(8.83, 2)).toEqual({ value: "8.83", rounded: false });
    expect(spreadsheetNumberToDecimal(0.1 + 0.2, 2)).toEqual({ value: "0.30", rounded: false });
    expect(spreadsheetNumberToDecimal(200, 3)).toEqual({ value: "200.000", rounded: false });
    expect(spreadsheetNumberToDecimal(6.96, 4)).toEqual({ value: "6.9600", rounded: false });
  });

  it("rounds half up beyond the allowed decimals and says so", () => {
    expect(spreadsheetNumberToDecimal(1.005, 2)).toEqual({ value: "1.01", rounded: true });
    expect(spreadsheetNumberToDecimal(100 / 3, 2)).toEqual({ value: "33.33", rounded: true });
    expect(spreadsheetNumberToDecimal(-2.345, 2)).toEqual({ value: "-2.35", rounded: true });
  });

  it("rejects values it cannot represent", () => {
    expect(spreadsheetNumberToDecimal(Number.NaN, 2)).toBeUndefined();
    expect(spreadsheetNumberToDecimal(1e21, 2)).toBeUndefined();
  });
});
