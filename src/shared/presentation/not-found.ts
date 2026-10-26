import { isDomainError } from "@/shared/domain/domain-error";

/** For `.catch()` on a lookup: a missing or malformed id becomes null, anything else is rethrown. */
export function notFoundAsNull(error: unknown): null {
  if (isDomainError(error) && (error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED")) return null;
  throw error;
}
