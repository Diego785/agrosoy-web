/** Today's date in Bolivia as an ISO date ("2026-10-26"), whatever the server's time zone. */
export function todayInBolivia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
