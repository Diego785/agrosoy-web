import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { testDb } from "@test/test-database";
import { auditLog } from "@/shared/infrastructure/audit/audit-log.table";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import {
  campaignOnDate,
  createCampaign,
  listCampaigns,
  setCampaignStatus,
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

  it("takes the season's due date unless another is written, never before the end (D37)", async () => {
    await createCampaign(deps(), admin, winter);
    const { id } = await createCampaign(deps(), admin, { ...summer, dueOn: "2027-04-30" });
    expect((await listCampaigns(deps(), admin)).map((campaign) => [campaign.season, campaign.dueOn])).toEqual(
      [
        ["summer", "2027-04-30"],
        ["winter", "2026-11-30"],
      ],
    );
    await expect(updateCampaign(deps(), admin, id, { ...summer, dueOn: "2027-03-01" })).rejects.toMatchObject(
      {
        code: "VALIDATION_FAILED",
        details: { fieldErrors: { dueOn: expect.any(Array) } },
      },
    );
    // A winter that sells until December can't keep 30 November without saying so.
    await expect(
      createCampaign(deps(), admin, { ...winter, year: 2027, startsOn: "2027-04-01", endsOn: "2027-12-15" }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { dueOn: expect.any(Array) } },
    });
  });

  it("only lets catalog managers change campaigns", async () => {
    await expect(createCampaign(deps(), actorWithRole("sales_technician"), winter)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const { id } = await createCampaign(deps(), admin, winter);
    await expect(
      setCampaignStatus(deps(), actorWithRole("sales_technician"), id, "closed"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("closes a campaign by hand and reopens it, both in the change log (D37)", async () => {
    const { id } = await createCampaign(deps(), admin, winter);
    await setCampaignStatus(deps(), admin, id, "closed");
    expect(await campaignOnDate(deps(), admin, "2026-06-01")).toMatchObject({ id, status: "closed" });

    // Closed, its dates can't change; closing it again changes nothing.
    const later = { ...winter, endsOn: "2026-10-31" };
    await expect(updateCampaign(deps(), admin, id, later)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await setCampaignStatus(deps(), admin, id, "closed");

    await setCampaignStatus(deps(), admin, id, "open");
    await updateCampaign(deps(), admin, id, later);
    expect(await campaignOnDate(deps(), admin, "2026-10-15")).toMatchObject({ id, status: "open" });
    const actions = await testDb.select({ action: auditLog.action }).from(auditLog);
    expect(actions.map((row) => row.action).sort()).toEqual(
      ["campaigns.create", "campaigns.close", "campaigns.reopen", "campaigns.update"].sort(),
    );
    await expect(setCampaignStatus(deps(), admin, id, "finished")).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });
});
