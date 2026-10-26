import { APIError } from "better-auth/api";
import { DomainError } from "@/shared/domain/domain-error";
import type { OwnCredentials } from "../application/ports";
import type { Auth } from "./auth";

/** Changes the signed-in user's password through Better Auth, which verifies the current one. */
export function betterAuthOwnCredentials(auth: Auth, requestHeaders: Headers): OwnCredentials {
  return {
    async changePassword(currentPassword, newPassword) {
      try {
        await auth.api.changePassword({
          body: { currentPassword, newPassword, revokeOtherSessions: true },
          headers: requestHeaders,
        });
      } catch (error) {
        if (error instanceof APIError && error.status === "BAD_REQUEST") {
          throw new DomainError("INVALID_CREDENTIALS");
        }
        throw error;
      }
    },
  };
}
