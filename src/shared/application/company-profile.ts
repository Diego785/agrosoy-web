import { z } from "zod";
import { DEFAULT_COMPANY_PROFILE, type CompanyProfile } from "@/shared/domain/company-profile";
import { cleanText } from "@/shared/domain/text";
import type { Actor } from "./actor";
import type { AuditTrail } from "./audit-trail";
import { assertCan } from "./permissions";
import type { SettingsStore } from "./settings-store";
import { validateInput } from "./validate-input";

const required = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: `Escribe ${label}.` })
    .max(max, { error: `Admite hasta ${max} caracteres.` });
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Admite hasta ${max} caracteres.` });

export const companyProfileSchema = z.object({
  brand: required("el nombre que sale en los documentos", 80),
  legalName: required("la razón social", 120),
  taxId: optional(30),
  city: required("la ciudad", 60),
  country: required("el país", 60),
  phone: optional(60),
  mobile: optional(60),
  email: optional(120),
  website: optional(120),
  facebook: optional(120),
});

export type CompanyProfileInput = z.input<typeof companyProfileSchema>;

/** What is stored, field by field over the defaults, so a missing or unreadable value never breaks a PDF. */
export async function readCompanyProfile(settings: SettingsStore): Promise<CompanyProfile> {
  const stored = await settings.get("company_profile");
  const profile = { ...DEFAULT_COMPANY_PROFILE };
  if (typeof stored !== "object" || stored === null) return profile;
  for (const key of Object.keys(profile) as (keyof CompanyProfile)[]) {
    const field = companyProfileSchema.shape[key].safeParse((stored as Record<string, unknown>)[key]);
    if (field.success) profile[key] = field.data;
  }
  return profile;
}

/** For the settings page (D26). */
export async function getCompanyProfile(
  deps: { settings: SettingsStore },
  actor: Actor,
): Promise<CompanyProfile> {
  assertCan(actor, "company.manage");
  return readCompanyProfile(deps.settings);
}

/** Administration keeps the company's details current; every document prints them from now on (D26). */
export async function updateCompanyProfile(
  deps: { settings: SettingsStore; audit: AuditTrail },
  actor: Actor,
  input: unknown,
): Promise<void> {
  assertCan(actor, "company.manage");
  const data = validateInput(companyProfileSchema, input);
  const profile = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, cleanText(value)]),
  ) as CompanyProfile;
  await deps.settings.set("company_profile", profile, actor.id);
  await deps.audit.record({
    actorId: actor.id,
    action: "settings.update_company",
    entityType: "setting",
    entityId: "company_profile",
    payload: { name: profile.brand },
  });
}
