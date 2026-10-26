import { describe, expect, it } from "vitest";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { Money } from "@/shared/domain/money";
import { allocate, allocatedTotal } from "./allocation";
import { cashNotePayment, paymentRecord } from "./payment";

const rate = ExchangeRate.parse("6.96");
const base = {
  paymentDate: "2026-11-02",
  customerId: "c",
  exchangeRate: rate,
  method: "cash",
  inKindDescription: null,
  reference: null,
  observations: null,
  settlesNoteId: null,
} as const;

describe("payments", () => {
  it("converts bolivianos to dollars at the payment's rate, half up to the cent", () => {
    const payment = paymentRecord({ ...base, amount: Money.parse("100", "BOB") });
    expect(payment.usdAmount.toDecimalString()).toBe("14.37");
    expect(payment.usdAmount.currency).toBe("USD");
  });

  it("keeps dollars as they are", () => {
    expect(paymentRecord({ ...base, amount: Money.parse("500") }).usdAmount.toDecimalString()).toBe("500.00");
  });

  it("requires a description for payments in kind and a positive amount", () => {
    expect(() => paymentRecord({ ...base, method: "in_kind", amount: Money.parse("10") })).toThrow(
      "VALIDATION_FAILED",
    );
    expect(() => paymentRecord({ ...base, amount: Money.zero() })).toThrow("INVALID_AMOUNT");
    expect(() => paymentRecord({ ...base, amount: Money.parse("0.01", "BOB") })).toThrow("INVALID_AMOUNT");
  });

  it("settles a cash note exactly, also when paid in bolivianos", () => {
    const payment = cashNotePayment({ ...base, total: Money.parse("750"), currency: "BOB", noteId: "n" });
    expect(payment.amount.toDecimalString()).toBe("5220.00");
    expect(payment.amount.currency).toBe("BOB");
    expect(payment.usdAmount.toDecimalString()).toBe("750.00");
    expect(payment.settlesNoteId).toBe("n");
  });
});

describe("allocating a payment", () => {
  const balances = [
    { campaignId: "summer26", startsOn: "2026-10-01", balance: Money.parse("300") },
    { campaignId: "winter26", startsOn: "2026-04-01", balance: Money.parse("200") },
    { campaignId: "summer25", startsOn: "2025-10-01", balance: Money.parse("-50") },
  ];
  const amounts = (allocations: ReturnType<typeof allocate>) =>
    allocations.map((allocation) => [allocation.campaignId, allocation.amount.toDecimalString()]);

  it("pays the oldest campaign that owes first", () => {
    expect(amounts(allocate(Money.parse("350"), { kind: "oldest_debt" }, balances, "summer26"))).toEqual([
      ["winter26", "200.00"],
      ["summer26", "150.00"],
    ]);
  });

  it("leaves an overpayment as a credit in the payment date's campaign", () => {
    const allocations = allocate(Money.parse("600"), { kind: "oldest_debt" }, balances, "summer26");
    expect(amounts(allocations)).toEqual([
      ["winter26", "200.00"],
      ["summer26", "400.00"],
    ]);
    expect(allocatedTotal(allocations).toDecimalString()).toBe("600.00");
    expect(amounts(allocate(Money.parse("80"), { kind: "oldest_debt" }, [], "summer26"))).toEqual([
      ["summer26", "80.00"],
    ]);
  });

  it("applies everything to the chosen campaign or note", () => {
    expect(
      allocate(Money.parse("80"), { kind: "note", noteId: "n1", campaignId: "summer26" }, balances, "x"),
    ).toEqual([{ campaignId: "summer26", noteId: "n1", amount: Money.parse("80") }]);
    expect(
      amounts(allocate(Money.parse("80"), { kind: "campaign", campaignId: "summer25" }, balances, "x")),
    ).toEqual([["summer25", "80.00"]]);
  });
});
