import { describe, expect, it } from "vitest";
import { DomainError } from "@/shared/domain/domain-error";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";
import { lineTotal, noteLine, noteTotal } from "./delivery-note";

const line = (quantity: string, price: string, freeOfCharge: "bonus" | "sample" | null = null) =>
  noteLine({
    presentationId: "p",
    quantity: Quantity.parse(quantity),
    unitPrice: Money.parse(price),
    freeOfCharge,
  });

describe("delivery note lines", () => {
  it("totals quantity × price, rounded to the cent", () => {
    expect(lineTotal(line("12", "62.50")).toDecimalString()).toBe("750.00");
    expect(lineTotal(line("2.5", "3.33")).toDecimalString()).toBe("8.33");
  });

  it("makes free-of-charge lines worth nothing whatever price was typed", () => {
    const sample = line("2", "36", "sample");
    expect(sample.unitPrice.isZero()).toBe(true);
    expect(lineTotal(sample).toDecimalString()).toBe("0.00");
  });

  it("requires a positive quantity, and a price unless the line is free", () => {
    expect(() => line("0", "10")).toThrow(DomainError);
    expect(() => line("2", "0")).toThrow(DomainError);
  });

  it("adds the note total", () => {
    expect(noteTotal([line("200", "11"), line("45", "22"), line("1", "5", "bonus")]).toDecimalString()).toBe(
      "3190.00",
    );
  });
});
