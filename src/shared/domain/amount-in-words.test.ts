import { describe, expect, it } from "vitest";
import { amountInWords } from "./amount-in-words";
import { Money } from "./money";

describe("amountInWords", () => {
  it.each([
    ["0", "CERO 00/100 DÓLARES AMERICANOS"],
    ["0.05", "CERO 05/100 DÓLARES AMERICANOS"],
    ["1", "UN 00/100 DÓLARES AMERICANOS"],
    ["16", "DIECISÉIS 00/100 DÓLARES AMERICANOS"],
    ["21", "VEINTIÚN 00/100 DÓLARES AMERICANOS"],
    ["31", "TREINTA Y UN 00/100 DÓLARES AMERICANOS"],
    ["100", "CIEN 00/100 DÓLARES AMERICANOS"],
    ["101", "CIENTO UN 00/100 DÓLARES AMERICANOS"],
    ["515", "QUINIENTOS QUINCE 00/100 DÓLARES AMERICANOS"],
    ["1000", "UN MIL 00/100 DÓLARES AMERICANOS"],
    ["1250.50", "UN MIL DOSCIENTOS CINCUENTA 50/100 DÓLARES AMERICANOS"],
    ["21000", "VEINTIÚN MIL 00/100 DÓLARES AMERICANOS"],
    ["100000", "CIEN MIL 00/100 DÓLARES AMERICANOS"],
    ["1000000", "UN MILLÓN 00/100 DÓLARES AMERICANOS"],
    [
      "2345678.09",
      "DOS MILLONES TRESCIENTOS CUARENTA Y CINCO MIL SEISCIENTOS SETENTA Y OCHO 09/100 DÓLARES AMERICANOS",
    ],
  ])("writes %s", (value, words) => {
    expect(amountInWords(Money.parse(value))).toBe(words);
  });

  it("names the currency paid", () => {
    expect(amountInWords(Money.parse("8700", "BOB"))).toBe("OCHO MIL SETECIENTOS 00/100 BOLIVIANOS");
  });
});
