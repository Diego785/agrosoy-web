import type { Role } from "@/shared/domain/role";
import { cleanText, optionalText } from "@/shared/domain/text";

/** Same rule Better Auth's username plugin applies: 3–30 letters, digits, dots or underscores. */
export const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Technicians and warehouse keepers may have no email, but Better Auth requires a unique one.
 * Those users get an address under the reserved `.invalid` domain, which can never receive mail.
 */
const PLACEHOLDER_EMAIL_DOMAIN = "usuarios.agrosoy.invalid";

/** What is printed on notes, receipts and expense reports next to the person's signature (D26). */
export type UserProfile = {
  name: string;
  /** "Ejecutivo de ventas". */
  position: string | null;
  /** The person's CI. */
  documentId: string | null;
  /** Only technicians have one; it heads their expense reports (D30). */
  workZone: string | null;
};

export type ProfileDetails = {
  name: string;
  position?: string;
  documentId?: string;
  workZone?: string;
};

export type NewUserAccount = UserProfile & {
  username: string;
  email: string;
  role: Role;
};

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function userProfile(details: ProfileDetails, role: Role): UserProfile {
  return {
    name: cleanText(details.name),
    position: optionalText(details.position) ?? null,
    documentId: optionalText(details.documentId)?.toUpperCase() ?? null,
    workZone: role === "sales_technician" ? (optionalText(details.workZone) ?? null) : null,
  };
}

export function newUserAccount(
  details: ProfileDetails & { username: string; email?: string; role: Role },
): NewUserAccount {
  const username = normalizeUsername(details.username);
  return {
    ...userProfile(details, details.role),
    username,
    email: optionalText(details.email)?.toLowerCase() ?? `${username}@${PLACEHOLDER_EMAIL_DOMAIN}`,
    role: details.role,
  };
}

/** The email to show people: placeholder addresses are not real, so they are hidden. */
export function visibleEmail(email: string): string | null {
  return email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`) ? null : email;
}
