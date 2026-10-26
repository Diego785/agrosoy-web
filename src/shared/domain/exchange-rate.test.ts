import { describe, expect, it } from "vitest";
import { DomainError } from "./domain-error";
import { ExchangeRate } from "./exchange-rate";
import { Money } from "./money";

describe("ExchangeRate", () => {
  it("converts bolivianos to dollars rounding half up", () => {
    const rate = ExchangeRate.parse("6.96");
    expect(rate.toUsd(Money.parse("696", "BOB")).toDecimalString()).toBe("100.00");
    // 100 / 6.96 = 14.3678… → 14.37
    expect(rate.toUsd(Money.parse("100", "BOB")).toDecimalString()).toBe("14.37");
  });

  it("converts dollars to bolivianos", () => {
    const rate = ExchangeRate.parse("11.5");
    expect(rate.toBob(Money.parse("20")).toDecimalString()).toBe("230.00");
    // 0.01 × 6.9655 = 0.069655 → 0.07
    expect(ExchangeRate.parse("6.9655").toBob(Money.parse("0.01")).toDecimalString()).toBe("0.07");
  });

  it("rounds negative amounts away from zero too", () => {
    const rate = ExchangeRate.parse("6.96");
    expect(rate.toUsd(Money.parse("-100", "BOB")).toDecimalString()).toBe("-14.37");
  });

  it("keeps four decimals", () => {
    expect(ExchangeRate.parse("6.96").toDecimalString()).toBe("6.9600");
    expect(ExchangeRate.parse("6.96").equals(ExchangeRate.parse("6.9600"))).toBe(true);
  });

  it.each(["0", "0.0000", "-6.96", "6,96", "6.96001", ""])("rejects %j", (value) => {
    expect(() => ExchangeRate.parse(value)).toThrow(DomainError);
  });

  it("refuses to convert from the wrong currency", () => {
    expect(() => ExchangeRate.parse("6.96").toUsd(Money.parse("10", "USD"))).toThrow();
  });
});
