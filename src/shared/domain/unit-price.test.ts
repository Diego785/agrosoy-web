import { describe, expect, it } from "vitest";
import { DomainError } from "./domain-error";
import { Money } from "./money";
import { Quantity } from "./quantity";
import { UnitPrice } from "./unit-price";

describe("UnitPrice (D60)", () => {
  it("keeps up to four decimals, as Agrosoil's sheets do", () => {
    expect(UnitPrice.parse("7.8833").toDecimalString()).toBe("7.8833");
    expect(UnitPrice.parse("9.5").toDecimalString()).toBe("9.5000");
    expect(() => UnitPrice.parse("7.88333")).toThrow(DomainError);
    expect(UnitPrice.fromMoney(Money.parse("15.50")).toDecimalString()).toBe("15.5000");
  });

  it("makes line totals rounded half up to the cent", () => {
    // 300 L at 7.8833 = 2364.99; at 7.88334 a sheet would show 2365.00, which the import keeps itself.
    expect(Quantity.parse("300").times(UnitPrice.parse("7.8833")).toDecimalString()).toBe("2364.99");
    // 2.5 × 3.3333 = 8.33325 → 8.33; 3 × 0.0050 = 0.015 → 0.02
    expect(Quantity.parse("2.5").times(UnitPrice.parse("3.3333")).toDecimalString()).toBe("8.33");
    expect(Quantity.parse("3").times(UnitPrice.parse("0.005")).toDecimalString()).toBe("0.02");
    expect(Quantity.parse("-2.5").times(UnitPrice.parse("3.33")).toDecimalString()).toBe("-8.33");
  });
});
