import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Actor } from "@/shared/application/actor";
import { effectivePermissions } from "@/shared/application/permissions";
import { isRole } from "@/shared/domain/role";
import { getDb } from "@/shared/infrastructure/db/client";
import { getAuth } from "../infrastructure/auth";
import { drizzlePermissionSettings } from "../infrastructure/drizzle-permission-settings";
import { CHANGE_PASSWORD_PATH, LOGIN_PATH } from "./identity-routes";

export type CurrentUser = {
  actor: Actor;
  username: string;
  mustChangePassword: boolean;
};

/** The session of this request, read once per render (React `cache`). Null when signed out. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Read the request first: during `next build` this is where prerendering stops, before
  // getAuth() would need the runtime secrets.
  const requestHeaders = await currentRequestHeaders();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session || session.user.banned || !isRole(session.user.role)) return null;
  // Read on every request, so a change to the permission matrix applies from the next click.
  const overrides = await drizzlePermissionSettings(getDb()).overrides();
  return {
    actor: {
      id: session.user.id,
      name: session.user.name,
      role: session.user.role,
      permissions: effectivePermissions(session.user.role, overrides),
    },
    username: session.user.displayUsername ?? session.user.username ?? "",
    mustChangePassword: session.user.mustChangePassword === true,
  };
});

/**
 * Request headers with the Cookie header taken from `cookies()`, which reflects cookies a server
 * action has just set. After a password change the page re-renders in the same response; with the
 * original header Better Auth would see the revoked session and clear the new cookie.
 */
async function currentRequestHeaders(): Promise<Headers> {
  const requestHeaders = new Headers(await headers());
  requestHeaders.set("cookie", (await cookies()).toString());
  return requestHeaders;
}

/**
 * Every page loader and server action starts here. Signed-out users go to the login page;
 * users holding a temporary password go to change it first.
 */
export async function requireActor({ allowPendingPasswordChange = false } = {}): Promise<Actor> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  if (user.mustChangePassword && !allowPendingPasswordChange) redirect(CHANGE_PASSWORD_PATH);
  return user.actor;
}
