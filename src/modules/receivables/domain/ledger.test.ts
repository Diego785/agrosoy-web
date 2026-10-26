import { describe, expect, it } from "vitest";
import { Money } from "@/shared/domain/money";
import { posting, reversalsOf, type LedgerEntry } from "./ledger";

const base = {
  customerId: "c",
  campaignId: "k",
  date: "2026-10-26",
  source: { type: "delivery_note", id: "n" },
} as const;

describe("ledger postings", () => {
  it("makes deliveries and charges debits, payments and returns credits", () => {
    const amount = Money.parse("100");
    expect(posting({ ...base, kind: "delivery", amount }).amount.toDecimalString()).toBe("100.00");
    expect(posting({ ...base, kind: "charge", amount }).amount.toDecimalString()).toBe("100.00");
    expect(posting({ ...base, kind: "payment", amount }).amount.toDecimalString()).toBe("-100.00");
    expect(posting({ ...base, kind: "return", amount }).amount.toDecimalString()).toBe("-100.00");
  });

  it("rejects empty or negative amounts, except an opening balance in the customer's favor", () => {
    expect(() => posting({ ...base, kind: "delivery", amount: Money.zero() })).toThrow("INVALID_AMOUNT");
    expect(() => posting({ ...base, kind: "payment", amount: Money.parse("-5") })).toThrow("INVALID_AMOUNT");
    expect(
      posting({ ...base, kind: "opening_balance", amount: Money.parse("-5") }).amount.toDecimalString(),
    ).toBe("-5.00");
  });
});

describe("reversals", () => {
  const entry = (id: string, amount: string, reversesEntryId: string | null = null): LedgerEntry => ({
    ...base,
    id,
    kind: "delivery",
    amount: Money.parse(amount),
    reversesEntryId,
  });

  it("cancels each entry on the void date, keeping its kind and campaign", () => {
    const [reversal] = reversalsOf([entry("e1", "750")], "2026-11-02");
    expect(reversal).toMatchObject({
      kind: "delivery",
      campaignId: "k",
      date: "2026-11-02",
      reversesEntryId: "e1",
    });
    expect(reversal?.amount.toDecimalString()).toBe("-750.00");
  });

  it("does not reverse twice", () => {
    expect(reversalsOf([entry("e1", "750"), entry("e2", "-750", "e1")], "2026-11-02")).toEqual([]);
  });
});
