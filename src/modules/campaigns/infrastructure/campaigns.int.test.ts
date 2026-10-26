import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { testDb } from "@test/test-database";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import {
  campaignOnDate,
  createCampaign,
  listCampaigns,
  updateCampaign,
} from "../application/campaign-use-cases";
import { drizzleCampaignRepository } from "./drizzle-campaign-repository";

const admin = actorWithRole("admin");
const deps = () => ({ campaigns: drizzleCampaignRepository(testDb), audit: drizzleAuditTrail(testDb) });

const winter = { season: "winter", year: 2026, startsOn: "2026-04-01", endsOn: "2026-09-30" };
const summer = { season: "summer", year: 2026, startsOn: "2026-10-01", endsOn: "2027-03-31" };

describe("campaigns", () => {
  it("creates campaigns, newest first, and finds the one for a date", async () => {
    await createCampaign(deps(), admin, winter);
    const { id } = await createCampaign(deps(), admin, summer);

    expect((await listCampaigns(deps(), admin)).map((campaign) => campaign.year + campaign.season)).toEqual([
      "2026summer",
      "2026winter",
    ]);
    expect(await campaignOnDate(deps(), actorWithRole("sales_technician"), "2026-10-26")).toMatchObject({
      id,
      status: "open",
    });
  });

  it("rejects overlapping dates and a repeated season in the same year", async () => {
    await createCampaign(deps(), admin, winter);
    await expect(createCampaign(deps(), admin, { ...summer, startsOn: "2026-09-15" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { startsOn: expect.any(Array) } },
    });
    await expect(
      createCampaign(deps(), admin, { ...winter, startsOn: "2027-04-01", endsOn: "2027-09-30" }),
    ).rejects.toMatchObject({ code: "DUPLICATE", details: { field: "year" } });
  });

  it("lets a campaign move its own dates without clashing with itself", async () => {
    const { id } = await createCampaign(deps(), admin, winter);
    await updateCampaign(deps(), admin, id, { ...winter, endsOn: "2026-10-15" });
    expect((await listCampaigns(deps(), admin))[0]?.endsOn).toBe("2026-10-15");
  });

  it("only lets catalog managers change campaigns", async () => {
    await expect(createCampaign(deps(), actorWithRole("sales_technician"), winter)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
