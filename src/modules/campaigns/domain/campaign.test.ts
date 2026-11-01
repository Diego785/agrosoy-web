import { describe, expect, it } from "vitest";
import { DomainError } from "@/shared/domain/domain-error";
import { campaignOn, campaignRecord, overlaps } from "./campaign";

const winter = { season: "winter" as const, year: 2026, startsOn: "2026-04-01", endsOn: "2026-09-30" };
const summer = { season: "summer" as const, year: 2026, startsOn: "2026-10-01", endsOn: "2027-03-31" };

describe("campaigns", () => {
  it("requires the end after the start", () => {
    expect(() => campaignRecord({ ...winter, endsOn: "2026-04-01" })).toThrow(DomainError);
    expect(campaignRecord(winter)).toEqual(winter);
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
});
