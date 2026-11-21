import { describe, expect, it } from "vitest";
import type { LedgerKind } from "@/modules/receivables/domain/ledger";
import { Money } from "@/shared/domain/money";
import {
  addDays,
  firstMonthFrom,
  interestAmount,
  interestProposals,
  interestReason,
  lastDayOf,
  monthName,
  proposalKey,
  splitDebt,
  type InterestEntry,
  type InterestSettings,
} from "./interest";

const winter = { id: "w26", dueOn: "2026-11-30" };
const summer = { id: "s26", dueOn: "2027-05-31" };
const settings: InterestSettings = { ratePercent: "3", graceDays: 30, startsOn: "2026-11-01" };
let nextId = 0;
const entry = (
  campaignId: string,
  date: string,
  amount: string,
  options: { kind?: LedgerKind; isInterest?: boolean; reverses?: string; id?: string } = {},
): InterestEntry => ({
  id: options.id ?? `e${++nextId}`,
  customerId: "roberto",
  campaignId,
  date,
  kind: options.kind ?? (options.isInterest ? "charge" : amount.startsWith("-") ? "payment" : "delivery"),
  amount: Money.parse(amount),
  isInterest: options.isInterest ?? false,
  reversesEntryId: options.reverses ?? null,
});

function propose(entries: InterestEntry[], today: string, overrides: object = {}) {
  return interestProposals({
    campaigns: [winter, summer],
    entries,
    extensionOf: () => undefined,
    decided: new Set(),
    settings,
    today,
    ...overrides,
  }).map((proposal) => [
    proposal.campaignId,
    proposal.month,
    proposal.base.toDecimalString(),
    proposal.amount.toDecimalString(),
  ]);
}

const decidedOf = (...months: string[]) =>
  new Set(months.map((month) => proposalKey({ customerId: "roberto", campaignId: "w26", month })));

describe("late-payment interest, month by month (D38)", () => {
  it("computes the rate on the base, rounded to the cent, and walks the calendar", () => {
    expect(interestAmount(Money.parse("2200"), "3").toDecimalString()).toBe("66.00");
    expect(interestAmount(Money.parse("1234.56"), "2.5").toDecimalString()).toBe("30.86");
    expect(addDays("2026-11-30", 15)).toBe("2026-12-15");
    expect(lastDayOf("2027-02")).toBe("2027-02-28");
    expect(lastDayOf("2026-12")).toBe("2026-12-31");
    expect(firstMonthFrom("2026-12-31")).toBe("2027-01");
    expect(firstMonthFrom("2026-12-01")).toBe("2026-12");
    expect(monthName("2027-01")).toBe("enero de 2027");
  });

  it("leaves December free with 30 days' grace and proposes January once it has ended", () => {
    const entries = [entry("w26", "2026-05-10", "10000")];
    expect(propose(entries, "2027-01-31")).toEqual([]);
    expect(propose(entries, "2027-02-01")).toEqual([["w26", "2027-01", "10000.00", "300.00"]]);
  });

  it("charges December too without grace days", () => {
    const entries = [entry("w26", "2026-05-10", "10000")];
    const noGrace = { settings: { ...settings, graceDays: 0 } };
    expect(propose(entries, "2027-01-01", noGrace)).toEqual([["w26", "2026-12", "10000.00", "300.00"]]);
  });

  it("follows a partial payment: interest first, then capital, and the next month on what is left", () => {
    // Administration's example: US$ 10.000; January charged; US$ 4.000 paid on 10 February.
    const entries = [
      entry("w26", "2026-05-10", "10000"),
      entry("w26", "2027-01-31", "300", { isInterest: true }),
      entry("w26", "2027-02-10", "-4000"),
    ];
    expect(propose(entries, "2027-03-01", { decided: decidedOf("2027-01") })).toEqual([
      ["w26", "2027-02", "6300.00", "189.00"],
    ]);
  });

  it("lists every month nobody reviewed, each counting the ones before it as charged", () => {
    const entries = [entry("w26", "2026-05-10", "1000"), entry("w26", "2027-02-10", "-100")];
    // February's payment covers January's 30 first, so 70 goes to capital.
    expect(propose(entries, "2027-04-01")).toEqual([
      ["w26", "2027-01", "1000.00", "30.00"],
      ["w26", "2027-02", "930.00", "27.90"],
      ["w26", "2027-03", "930.00", "27.90"],
    ]);
  });

  it("never proposes a decided month again, even when the due date moves afterwards", () => {
    const entries = [entry("w26", "2026-05-10", "1000")];
    const decided = decidedOf("2027-01");
    expect(propose(entries, "2027-02-15", { decided })).toEqual([]);
    expect(propose(entries, "2027-02-15", { decided, extensionOf: () => "2026-12-15" })).toEqual([]);
  });

  it("charges a month only if it ends with debt: paying in full on 15 May leaves May out", () => {
    const entries = [entry("w26", "2026-05-10", "1000"), entry("w26", "2027-05-15", "-2000")];
    expect(propose(entries, "2027-06-01").map(([, month]) => month)).toEqual([
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
    ]);
  });

  it("waits for a customer's extension, then the grace days", () => {
    const entries = [entry("w26", "2026-05-10", "1000")];
    // Extended to 31 December: January is free, February is the first month.
    expect(propose(entries, "2027-02-01", { extensionOf: () => "2026-12-31" })).toEqual([]);
    expect(propose(entries, "2027-03-01", { extensionOf: () => "2026-12-31" })).toEqual([
      ["w26", "2027-02", "1000.00", "30.00"],
    ]);
  });

  it("proposes nothing for a campaign paid in full or in the customer's favor", () => {
    expect(
      propose([entry("w26", "2026-05-10", "100"), entry("w26", "2026-06-01", "-300")], "2027-02-01"),
    ).toEqual([]);
  });

  it("leaves voided documents out of the base, even when the void came later", () => {
    const entries = [
      entry("w26", "2026-05-10", "1000"),
      entry("w26", "2026-06-10", "500", { id: "wrong-note" }),
      entry("w26", "2027-01-20", "-500", { kind: "delivery", reverses: "wrong-note" }),
    ];
    expect(propose(entries, "2027-02-01")).toEqual([["w26", "2027-01", "1000.00", "30.00"]]);
  });

  it("proposes nothing for months before the day interest starts, or until that day is set", () => {
    const entries = [entry("w26", "2026-05-10", "1000")];
    expect(propose(entries, "2027-03-01", { settings: { ...settings, startsOn: "2027-02-01" } })).toEqual([
      ["w26", "2027-02", "1000.00", "30.00"],
    ]);
    expect(propose(entries, "2027-03-01", { settings: { ...settings, startsOn: null } })).toEqual([]);
  });

  it("explains the charge with the rate, the month and the base", () => {
    const proposal = {
      customerId: "roberto",
      campaignId: "w26",
      month: "2027-01",
      interestDate: "2027-01-31",
      base: Money.parse("1234567.5"),
      amount: Money.parse("37037.03"),
    };
    expect(interestReason(proposal, "2.5")).toBe("2,5 % por mora de enero de 2027 sobre US$ 1.234.567,50");
  });
});

describe("payments cover interest first (D45)", () => {
  it("splits each payment between the interest owed at the time and capital", () => {
    const entries = [
      entry("w26", "2026-05-10", "200"),
      entry("w26", "2027-01-31", "50", { isInterest: true }),
      entry("w26", "2027-02-10", "-100", { id: "pay" }),
    ];
    const split = splitDebt(entries);
    expect(split.capital.toDecimalString()).toBe("150.00");
    expect(split.interest.toDecimalString()).toBe("0.00");
    expect(split.payments.get("pay")?.toInterest.toDecimalString()).toBe("50.00");
    expect(split.payments.get("pay")?.toCapital.toDecimalString()).toBe("50.00");
  });

  it("sends a payment made before any interest to capital, and returns never to interest", () => {
    const entries = [
      entry("w26", "2026-05-10", "200"),
      entry("w26", "2026-12-01", "-50", { id: "early" }),
      entry("w26", "2027-01-31", "30", { isInterest: true }),
      entry("w26", "2027-02-01", "-20", { kind: "return" }),
    ];
    const split = splitDebt(entries);
    expect(split.payments.get("early")?.toInterest.toDecimalString()).toBe("0.00");
    expect(split.capital.toDecimalString()).toBe("130.00");
    expect(split.interest.toDecimalString()).toBe("30.00");
    expect(splitDebt(entries, "2027-01-15").capital.toDecimalString()).toBe("150.00");
  });
});
