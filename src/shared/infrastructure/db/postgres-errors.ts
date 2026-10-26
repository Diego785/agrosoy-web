const UNIQUE_VIOLATION = "23505";

type PostgresError = { code?: string; constraint?: string };

/** Drizzle wraps driver errors in `cause`; this looks at both levels. */
function postgresErrorOf(error: unknown): PostgresError | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = "cause" in error && error.cause ? error.cause : error;
  return typeof candidate === "object" && candidate !== null ? (candidate as PostgresError) : undefined;
}

/** Name of the unique constraint that rejected the write, if that is what happened. */
export function violatedUniqueConstraint(error: unknown): string | undefined {
  const pgError = postgresErrorOf(error);
  return pgError?.code === UNIQUE_VIOLATION ? pgError.constraint : undefined;
}
