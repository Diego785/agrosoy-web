// Display formats for Bolivia: 34.238,89 and 30/04/2026. Inputs are the decimal strings that DTOs
// carry; Intl formats them as exact decimals, so no float rounding happens here.

type DecimalString = `${number}` | string;

const money = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantity = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 3 });
const rate = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const percent = new Intl.NumberFormat("es-BO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("es-BO");

// Intl.NumberFormat accepts decimal strings at runtime (ECMA-402 v3); the lib types still say number.
const exact = (value: DecimalString) => value as unknown as number;

/** "34.238,89" */
export function formatMoney(value: DecimalString): string {
  return money.format(exact(value));
}

/** "US$ 34.238,89" */
export function formatUsd(value: DecimalString): string {
  return `US$ ${formatMoney(value)}`;
}

/** "200" or "2,5" */
export function formatQuantity(value: DecimalString): string {
  return quantity.format(exact(value));
}

/** "6,96" */
export function formatRate(value: DecimalString): string {
  return rate.format(exact(value));
}

/** Tenths of a percent (67) as "6,7 %". */
export function formatPerMille(value: number): string {
  return `${percent.format(value / 10)} %`;
}

export function formatCount(value: number): string {
  return integer.format(value);
}

/** ISO date "2026-04-30" as "30/04/2026", without time-zone shifts. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

const dateTime = new Intl.DateTimeFormat("es-BO", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/La_Paz",
});

/** A moment, shown in Bolivia time: "26/10/2026, 12:30". */
export function formatDateTime(moment: Date): string {
  return dateTime.format(moment);
}
