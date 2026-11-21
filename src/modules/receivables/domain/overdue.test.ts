import { describe, expect, it } from "vitest";
import { Money } from "@/shared/domain/money";
import { overdueByCampaign, totalOverdue } from "./overdue";

const entry = (campaignId: string, amount: string) => ({ campaignId, amount: Money.parse(amount) });
const dueDates: Record<string, string> = { winter: "2026-11-30", summer: "2027-05-31" };

describe("overdue debt (D37)", () => {
  const entries = [entry("winter", "2200"), entry("winter", "-1500"), entry("summer", "400")];

  it("counts nothing before the due date, and the whole campaign balance after it", () => {
    const before = overdueByCampaign(entries, (id) => dueDates[id], "2026-11-30");
    expect(before.size).toBe(0);

    const after = overdueByCampaign(entries, (id) => dueDates[id], "2026-12-01");
    expect(Object.fromEntries([...after].map(([id, amount]) => [id, amount.toDecimalString()]))).toEqual({
      winter: "700.00",
    });
    expect(totalOverdue(after).toDecimalString()).toBe("700.00");
  });

  it("follows an extension and never counts a balance in the customer's favor", () => {
    const extended = overdueByCampaign(
      entries,
      (id) => (id === "winter" ? "2026-12-15" : dueDates[id]),
      "2026-12-01",
    );
    expect(extended.size).toBe(0);

    const paidAhead = [entry("winter", "100"), entry("winter", "-300")];
    expect(overdueByCampaign(paidAhead, (id) => dueDates[id], "2027-01-10").size).toBe(0);
  });
});
