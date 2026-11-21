import { describe, expect, it } from "vitest";
import { DomainError } from "@/shared/domain/domain-error";
import {
  campaignOn,
  campaignRecord,
  defaultDueOn,
  effectiveDueOn,
  nextCampaign,
  noteCampaigns,
  overlaps,
  previousCampaign,
} from "./campaign";

const winter = {
  season: "winter" as const,
  year: 2026,
  startsOn: "2026-04-01",
  endsOn: "2026-09-30",
  dueOn: "2026-11-30",
};
const summer = {
  season: "summer" as const,
  year: 2026,
  startsOn: "2026-10-01",
  endsOn: "2027-03-31",
  dueOn: "2027-05-31",
};

describe("campaigns", () => {
  it("requires the end after the start, and the due date not before the end", () => {
    expect(() => campaignRecord({ ...winter, endsOn: "2026-04-01" })).toThrow(DomainError);
    expect(() => campaignRecord({ ...winter, dueOn: "2026-09-29" })).toThrow(DomainError);
    expect(campaignRecord(winter)).toEqual(winter);
  });

  it("falls due on Agrosoil's contract dates unless the customer was given more time (D37)", () => {
    expect(defaultDueOn("winter", "2026-09-30")).toBe("2026-11-30");
    expect(defaultDueOn("summer", "2027-03-31")).toBe("2027-05-31");
    expect(effectiveDueOn("2026-11-30", undefined)).toBe("2026-11-30");
    expect(effectiveDueOn("2026-11-30", "2026-12-15")).toBe("2026-12-15");
    // An extension left behind after the campaign's date moved past it no longer shortens it.
    expect(effectiveDueOn("2026-12-31", "2026-12-15")).toBe("2026-12-31");
  });

  it("detects overlapping periods, including a shared day", () => {
    expect(overlaps(winter, summer)).toBe(false);
    expect(overlaps(winter, { startsOn: "2026-09-30", endsOn: "2026-12-31" })).toBe(true);
  });

  it("finds the campaign a date belongs to", () => {
    expect(campaignOn([winter, summer], "2026-10-26")).toBe(summer);
    expect(campaignOn([winter, summer], "2026-09-30")).toBe(winter);
    expect(campaignOn([winter, summer], "2027-04-01")).toBeUndefined();
  });

  it("finds the campaign before, for copying its prices", () => {
    const older = { id: "w25", ...winter, year: 2025, startsOn: "2025-04-01", endsOn: "2025-09-30" };
    const all = [{ id: "s26", ...summer }, { id: "w26", ...winter }, older];
    expect(previousCampaign(all, all[0]!)?.id).toBe("w26");
    expect(previousCampaign(all, all[1]!)?.id).toBe("w25");
    expect(previousCampaign(all, older)).toBeUndefined();
  });

  it("finds the campaign after", () => {
    const older = { id: "w25", ...winter, year: 2025, startsOn: "2025-04-01", endsOn: "2025-09-30" };
    const all = [{ id: "s26", ...summer }, { id: "w26", ...winter }, older];
    expect(nextCampaign(all, older)?.id).toBe("w26");
    expect(nextCampaign(all, all[1]!)?.id).toBe("s26");
    expect(nextCampaign(all, all[0]!)).toBeUndefined();
  });

  it("lets a note take the campaign before or after its date's while that one is open (D37)", () => {
    const open = { status: "open" as const };
    const summer26 = { id: "s26", ...summer, ...open };
    const winter26 = { id: "w26", ...winter, ...open };
    const summer25 = {
      id: "s25",
      ...summer,
      year: 2025,
      startsOn: "2025-10-01",
      endsOn: "2026-03-31",
      status: "closed" as const,
    };
    const winter25 = {
      id: "w25",
      ...winter,
      year: 2025,
      startsOn: "2025-04-01",
      endsOn: "2025-09-30",
      ...open,
    };
    const all = [summer26, winter26, summer25, winter25];
    type Choice = { id: string; startsOn: string; endsOn: string; status: "open" | "closed" };
    const ids = (date: string, campaigns: readonly Choice[] = all) =>
      noteCampaigns(campaigns, date).map((one) => one.id);
    // The date's own first, then the open neighbors: before, then after. Summer 2025 is closed and
    // winter 2025 is open but two campaigns away, so a winter 2026 date only gets summer 2026.
    expect(ids("2026-10-26")).toEqual(["s26", "w26"]);
    expect(ids("2026-06-01")).toEqual(["w26", "s26"]);
    expect(ids("2026-10-26", [summer26, { ...winter26, status: "closed" }])).toEqual(["s26"]);
    expect(ids("2026-06-01", [{ ...summer26, status: "closed" }, winter26])).toEqual(["w26"]);
    // Closing blocks new documents dated in the campaign: its dates take no neighbor either.
    expect(ids("2026-01-15")).toEqual(["s25"]);
    expect(ids("2027-04-01")).toEqual([]);
  });
});
