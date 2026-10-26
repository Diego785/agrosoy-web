/**
 * Every expected business failure has a stable code. The presentation layer turns codes into
 * Spanish messages; nothing below it writes user-facing text (docs/decisions.md, D11).
 */
export const ERROR_CODES = [
  "INVALID_AMOUNT",
  "INVALID_QUANTITY",
  "INVALID_EXCHANGE_RATE",
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "DUPLICATE",
  "FORBIDDEN",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(code);
    this.name = "DomainError";
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
