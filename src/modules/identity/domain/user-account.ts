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

export type NewUserAccount = {
  name: string;
  username: string;
  email: string;
  role: Role;
};

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function newUserAccount(details: {
  name: string;
  username: string;
  email?: string;
  role: Role;
}): NewUserAccount {
  const username = normalizeUsername(details.username);
  return {
    name: cleanText(details.name),
    username,
    email: optionalText(details.email)?.toLowerCase() ?? `${username}@${PLACEHOLDER_EMAIL_DOMAIN}`,
    role: details.role,
  };
}

/** The email to show people: placeholder addresses are not real, so they are hidden. */
export function visibleEmail(email: string): string | null {
  return email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`) ? null : email;
}
