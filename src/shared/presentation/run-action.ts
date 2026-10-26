import "server-only";
import { unstable_rethrow } from "next/navigation";
import { isDomainError } from "@/shared/domain/domain-error";
import type { ActionError, ActionResult } from "./action-result";

/**
 * Wraps a server action body: expected business errors become a typed result for the form;
 * anything else is logged and reported as UNEXPECTED, without leaking internals to the browser.
 */
export async function runAction<T>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    // redirect() and notFound() work by throwing; Next.js must receive them.
    unstable_rethrow(error);
    if (isDomainError(error)) {
      return { ok: false, error: toActionError(error.code, error.details) };
    }
    console.error(error);
    return { ok: false, error: { code: "UNEXPECTED" } };
  }
}

function toActionError(code: ActionError["code"], details: Readonly<Record<string, unknown>>): ActionError {
  const error: ActionError = { code };
  if (typeof details.field === "string") error.field = details.field;
  if (isFieldErrors(details.fieldErrors)) error.fieldErrors = details.fieldErrors;
  return error;
}

function isFieldErrors(value: unknown): value is Record<string, string[]> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((messages) => Array.isArray(messages))
  );
}
