import { describe, expect, it } from "vitest";
import { DomainError } from "./domain-error";
import { Money } from "./money";

describe("Money", () => {
  it("parses decimal strings exactly", () => {
    expect(Money.parse("1234.5").cents).toBe(123450n);
    expect(Money.parse("-0.07").cents).toBe(-7n);
    expect(Money.parse(" 10 ").toDecimalString()).toBe("10.00");
  });

  it.each(["1.234", "1,234.00", "12,50", "", "abc", "1e3", "--1"])("rejects %j", (value) => {
    expect(() => Money.parse(value)).toThrow(DomainError);
  });

  it("adds without floating point drift", () => {
    const total = Money.sum([Money.parse("0.10"), Money.parse("0.20")]);
    expect(total.equals(Money.parse("0.30"))).toBe(true);
  });

  it("handles amounts far beyond any statement", () => {
    const big = Money.parse("90071992547409.93");
    expect(big.add(Money.parse("0.10")).toDecimalString()).toBe("90071992547410.03");
  });

  it("compares and subtracts", () => {
    const debt = Money.parse("1920");
    const payment = Money.parse("2306.89");
    expect(payment.compare(debt)).toBe(1);
    expect(debt.subtract(payment).toDecimalString()).toBe("-386.89");
    expect(debt.subtract(payment).isNegative()).toBe(true);
  });

  it("formats negatives and zero for Postgres numeric", () => {
    expect(Money.ofCents(-5).toDecimalString()).toBe("-0.05");
    expect(Money.ofCents(-0).toDecimalString()).toBe("0.00");
    expect(Money.zero().negate().toDecimalString()).toBe("0.00");
  });

  it("refuses to mix currencies", () => {
    expect(() => Money.parse("1", "USD").add(Money.parse("1", "BOB"))).toThrow();
  });

  it("refuses non-integer cents", () => {
    expect(() => Money.ofCents(1.5)).toThrow(RangeError);
  });
});
