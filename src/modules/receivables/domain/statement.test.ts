import { describe, expect, it } from "vitest";
import { Money } from "@/shared/domain/money";
import { addTotals, collectedPerMille, statementTotals } from "./statement";

const usd = (value: string) => Money.parse(value);

describe("statementTotals", () => {
  it("owes while deliveries exceed payments and returns", () => {
    const totals = statementTotals({
      delivered: [usd("144"), usd("900")],
      paid: [usd("176.60")],
      returned: [usd("36")],
    });
    expect(totals.balance.toDecimalString()).toBe("831.40");
    expect(totals.status).toBe("owing");
  });

  it("is settled when paid in full or overpaid, like the spreadsheet's Cancelado", () => {
    expect(statementTotals({ delivered: [usd("750")], paid: [usd("750")], returned: [] }).status).toBe(
      "settled",
    );
    expect(statementTotals({ delivered: [usd("750")], paid: [usd("800")], returned: [] }).status).toBe(
      "settled",
    );
  });

  it("adds customers into portfolio totals", () => {
    const total = addTotals([
      statementTotals({ delivered: [usd("750")], paid: [usd("750")], returned: [] }),
      statementTotals({ delivered: [usd("1044")], paid: [usd("176.60")], returned: [usd("36")] }),
    ]);
    expect(total.delivered.toDecimalString()).toBe("1794.00");
    expect(total.balance.toDecimalString()).toBe("831.40");
  });
});

describe("collectedPerMille", () => {
  it("is collected over net sales, in tenths of a percent", () => {
    const totals = statementTotals({ delivered: [usd("34238.89")], paid: [usd("2306.89")], returned: [] });
    expect(collectedPerMille(totals)).toBe(67);
  });

  it("is null without sales", () => {
    expect(collectedPerMille(statementTotals({ delivered: [], paid: [], returned: [] }))).toBeNull();
  });
});
