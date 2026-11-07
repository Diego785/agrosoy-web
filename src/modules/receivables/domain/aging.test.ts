import { describe, expect, it } from "vitest";
import { Money } from "@/shared/domain/money";
import { aging, daysBetween, withoutReversedPairs } from "./aging";
import { ledgerTotals } from "./statement";

const entry = (date: string, amount: string) => ({ date, amount: Money.parse(amount) });
const asText = (result: ReturnType<typeof aging>) =>
  Object.fromEntries(Object.entries(result).map(([bucket, amount]) => [bucket, amount.toDecimalString()]));

describe("aging", () => {
  it("counts days between business dates", () => {
    expect(daysBetween("2026-10-01", "2026-12-30")).toBe(90);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
  });

  it("pays the oldest debits first and ages what is left", () => {
    const result = aging(
      [
        entry("2026-06-01", "1000"),
        entry("2026-09-15", "500"),
        entry("2026-10-20", "300"),
        entry("2026-10-25", "-1200"),
      ],
      "2026-11-02",
    );
    expect(asText(result)).toEqual({ upTo30: "300.00", upTo60: "300.00", upTo90: "0.00", over90: "0.00" });
  });

  it("leaves nothing when the customer is settled or in favor", () => {
    const result = aging([entry("2026-06-01", "100"), entry("2026-06-02", "-150")], "2026-11-02");
    expect(asText(result)).toEqual({ upTo30: "0.00", upTo60: "0.00", upTo90: "0.00", over90: "0.00" });
  });

  it("ignores voided documents and their reversals", () => {
    const entries = [
      { id: "a", reversesEntryId: null },
      { id: "b", reversesEntryId: null },
      { id: "c", reversesEntryId: "b" },
    ];
    expect(withoutReversedPairs(entries).map((item) => item.id)).toEqual(["a"]);
  });
});

describe("statement columns from the ledger", () => {
  it("nets reversals out of their own column and puts charges with the others", () => {
    const totals = ledgerTotals([
      { kind: "delivery", amount: Money.parse("2200") },
      { kind: "delivery", amount: Money.parse("750") },
      { kind: "delivery", amount: Money.parse("-750") },
      { kind: "payment", amount: Money.parse("-1000") },
      { kind: "payment", amount: Money.parse("-100") },
      { kind: "payment", amount: Money.parse("100") },
      { kind: "return", amount: Money.parse("-200") },
      { kind: "charge", amount: Money.parse("50") },
    ]);
    expect(
      Object.fromEntries(
        (["delivered", "paid", "returned", "other", "balance"] as const).map((column) => [
          column,
          totals[column].toDecimalString(),
        ]),
      ),
    ).toEqual({
      delivered: "2200.00",
      paid: "1000.00",
      returned: "200.00",
      other: "50.00",
      balance: "1050.00",
    });
    expect(totals.status).toBe("owing");
  });
});
