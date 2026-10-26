import { describe, expect, it } from "vitest";
import { DomainError } from "./domain-error";
import { Money } from "./money";
import { Quantity } from "./quantity";

describe("Quantity", () => {
  it("computes line totals rounded half up to the cent", () => {
    expect(Quantity.parse("3").times(Money.parse("145.50")).toDecimalString()).toBe("436.50");
    // 2.5 × 3.33 = 8.325 → 8.33
    expect(Quantity.parse("2.5").times(Money.parse("3.33")).toDecimalString()).toBe("8.33");
    // A returned line is negative and rounds the same way: −8.325 → −8.33
    expect(Quantity.parse("-2.5").times(Money.parse("3.33")).toDecimalString()).toBe("-8.33");
  });

  it("keeps the currency of the price", () => {
    expect(Quantity.parse("2").times(Money.parse("10", "BOB")).currency).toBe("BOB");
  });

  it("adds, subtracts and compares", () => {
    const delivered = Quantity.parse("500");
    const returned = Quantity.parse("120.250");
    expect(delivered.subtract(returned).toDecimalString()).toBe("379.750");
    expect(returned.compare(delivered)).toBe(-1);
    expect(Quantity.sum([delivered, returned.negate()]).toDecimalString()).toBe("379.750");
  });

  it("keeps three decimals", () => {
    expect(Quantity.parse("0.125").toDecimalString()).toBe("0.125");
    expect(() => Quantity.parse("0.1255")).toThrow(DomainError);
    expect(() => Quantity.parse("1,5")).toThrow(DomainError);
  });
});
