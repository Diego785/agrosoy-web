import { describe, expect, it } from "vitest";
import { actorWithRole } from "@test/actors";
import { testDb } from "@test/test-database";
import {
  getCompanyProfile,
  readCompanyProfile,
  updateCompanyProfile,
} from "@/shared/application/company-profile";
import { DEFAULT_COMPANY_PROFILE } from "@/shared/domain/company-profile";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { drizzleSettingsStore } from "./app-settings";

const admin = actorWithRole("admin");
const deps = () => ({ settings: drizzleSettingsStore(testDb), audit: drizzleAuditTrail(testDb) });

describe("company profile (D26)", () => {
  it("prints the known details until administration changes them", async () => {
    expect(await getCompanyProfile(deps(), admin)).toEqual(DEFAULT_COMPANY_PROFILE);

    await updateCompanyProfile(deps(), admin, {
      ...DEFAULT_COMPANY_PROFILE,
      mobile: "  68767600   -  76662583 ",
      website: "",
    });
    expect(await readCompanyProfile(drizzleSettingsStore(testDb))).toEqual({
      ...DEFAULT_COMPANY_PROFILE,
      mobile: "68767600 - 76662583",
      website: "",
    });
  });

  it("keeps the defaults for what is missing or unreadable, and is for administration", async () => {
    await drizzleSettingsStore(testDb).set("company_profile", { brand: "Agrosoil", phone: 42 }, "test");
    expect(await readCompanyProfile(drizzleSettingsStore(testDb))).toEqual({
      ...DEFAULT_COMPANY_PROFILE,
      brand: "Agrosoil",
    });

    await expect(
      updateCompanyProfile(deps(), admin, { ...DEFAULT_COMPANY_PROFILE, brand: " " }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: { fieldErrors: { brand: expect.any(Array) } },
    });
    await expect(getCompanyProfile(deps(), actorWithRole("sales_technician"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
