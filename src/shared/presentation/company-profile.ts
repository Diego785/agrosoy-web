import "server-only";
import { readCompanyProfile } from "@/shared/application/company-profile";
import type { CompanyProfile } from "@/shared/domain/company-profile";
import { drizzleSettingsStore } from "@/shared/infrastructure/db/app-settings";
import { getDb } from "@/shared/infrastructure/db/client";

/** The company's details as administration last saved them (D26), for the documents being printed. */
export function loadCompanyProfile(): Promise<CompanyProfile> {
  return readCompanyProfile(drizzleSettingsStore(getDb()));
}
