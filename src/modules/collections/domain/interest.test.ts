import { describe, expect, it } from "vitest";
import { Money } from "@/shared/domain/money";
import {
  addDays,
  interestAmount,
  interestProposals,
  interestReason,
  proposalKey,
  type InterestEntry,
  type InterestSettings,
} from "./interest";

const winter = { id: "w26", dueOn: "2026-11-30" };
const summer = { id: "s26", dueOn: "2027-05-31" };
const settings: InterestSettings = { ratePercent: "3", graceDays: 0, startsOn: "2026-11-01" };
let nextId = 0;
const entry = (
  campaignId: string,
  date: string,
  amount: string,
  options: { isInterest?: boolean; reverses?: string; id?: string } = {},
): InterestEntry => ({
  id: options.id ?? `e${++nextId}`,
  customerId: "roberto",
  campaignId,
  date,
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
    proposal.interestDate,
    proposal.base.toDecimalString(),
    proposal.amount.toDecimalString(),
  ]);
}

describe("late-payment interest (D38)", () => {
  it("computes the rate on the base, rounded to the cent, and adds days across months", () => {
    expect(interestAmount(Money.parse("2200"), "3").toDecimalString()).toBe("66.00");
    expect(interestAmount(Money.parse("1234.56"), "2.5").toDecimalString()).toBe("30.86");
    expect(addDays("2026-11-30", 15)).toBe("2026-12-15");
  });

  it("proposes 3 % once the due date has passed, on what is still owed that day", () => {
    const entries = [entry("w26", "2026-05-10", "2200"), entry("w26", "2026-11-01", "-1000")];
    expect(propose(entries, "2026-11-30")).toEqual([]);
    expect(propose(entries, "2026-12-01")).toEqual([["w26", "2026-11-30", "1200.00", "36.00"]]);
  });

  it("proposes again when the next campaign falls due, without interest on interest", () => {
    const entries = [
      entry("w26", "2026-05-10", "2200"),
      entry("w26", "2026-12-10", "66", { isInterest: true }),
      entry("s26", "2026-10-26", "400"),
    ];
    const decided = new Set([
      proposalKey({ customerId: "roberto", campaignId: "w26", interestDate: "2026-11-30" }),
    ]);
    expect(propose(entries, "2027-06-01", { decided })).toEqual([
      ["s26", "2027-05-31", "400.00", "12.00"],
      ["w26", "2027-05-31", "2200.00", "66.00"],
    ]);
  });

  it("waits for the grace days and for a customer's extension", () => {
    const entries = [entry("w26", "2026-05-10", "2200")];
    const grace = { settings: { ...settings, graceDays: 15 } };
    expect(propose(entries, "2026-12-10", grace)).toEqual([]);
    expect(propose(entries, "2026-12-16", grace)).toEqual([["w26", "2026-12-15", "2200.00", "66.00"]]);
    expect(propose(entries, "2026-12-10", { extensionOf: () => "2026-12-20" })).toEqual([]);
    expect(propose(entries, "2026-12-21", { extensionOf: () => "2026-12-20" })).toEqual([
      ["w26", "2026-12-20", "2200.00", "66.00"],
    ]);
  });

  it("proposes nothing for a campaign paid in full or in the customer's favor", () => {
    expect(
      propose([entry("w26", "2026-05-10", "100"), entry("w26", "2026-06-01", "-300")], "2026-12-01"),
    ).toEqual([]);
  });

  it("leaves voided documents out of the base, even when the void came later", () => {
    const entries = [
      entry("w26", "2026-05-10", "2200"),
      entry("w26", "2026-06-10", "500", { id: "wrong-note" }),
      entry("w26", "2026-12-05", "-500", { reverses: "wrong-note" }),
    ];
    expect(propose(entries, "2026-12-06")).toEqual([["w26", "2026-11-30", "2200.00", "66.00"]]);
  });

  it("proposes nothing before the day interest starts, or until that day is set", () => {
    const entries = [entry("w25", "2025-06-10", "900"), entry("w26", "2026-05-10", "2200")];
    const campaigns = [
      { id: "w25", dueOn: "2025-11-30" },
      { id: "s25", dueOn: "2026-05-31" },
      winter,
      summer,
    ];
    expect(propose(entries, "2026-12-01", { campaigns })).toEqual([
      ["w25", "2026-11-30", "900.00", "27.00"],
      ["w26", "2026-11-30", "2200.00", "66.00"],
    ]);
    expect(propose(entries, "2026-12-01", { campaigns, settings: { ...settings, startsOn: null } })).toEqual(
      [],
    );
  });

  it("explains the charge with the rate, the base and the day", () => {
    const proposal = {
      customerId: "roberto",
      campaignId: "w26",
      interestDate: "2026-11-30",
      base: Money.parse("1234567.5"),
      amount: Money.parse("37037.03"),
    };
    expect(interestReason(proposal, "2.5")).toBe(
      "2,5 % por mora sobre US$ 1.234.567,50 adeudados al 30/11/2026",
    );
  });
});
