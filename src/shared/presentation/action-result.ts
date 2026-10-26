import type { ErrorCode } from "@/shared/domain/domain-error";

export type ActionError = {
  code: ErrorCode | "UNEXPECTED";
  /** Field path → messages, for VALIDATION_FAILED. */
  fieldErrors?: Record<string, string[]>;
  /** The offending field, for DUPLICATE. */
  field?: string;
};

/** What every server action returns: plain data, safe to send to the browser (D10). */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };
