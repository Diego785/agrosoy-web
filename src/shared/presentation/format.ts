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

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** ISO date "2026-10-28" as "28 de octubre de 2026", the way receipts write it. */
export function formatLongDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${Number(day)} de ${MONTHS[Number(month) - 1]} de ${year}`;
}

/** Printed document numbers have six digits, like the pads: 12951 → "012951" (D26). */
export function formatDocumentNumber(value: number): string {
  return String(value).padStart(6, "0");
}

/**
 * What is typed in a date field, shaped as "dd/mm/aaaa": "01112026" → "01/11/2026". A slash closes
 * a part early ("1/" is day 01), and a slash only shows once something follows it, so backspace
 * can remove it.
 */
export function maskTypedDate(raw: string): string {
  const parts = ["", "", ""];
  const sizes = [2, 2, 4];
  let part = 0;
  for (const char of raw) {
    if (char === "/") {
      if (part < 2 && parts[part]) {
        parts[part] = parts[part]!.padStart(2, "0");
        part++;
      }
    } else if (/\d/.test(char)) {
      if (parts[part]!.length === sizes[part]!) {
        if (part === 2) break;
        part++;
      }
      parts[part] += char;
    }
  }
  const [day, month, year] = parts;
  return [day, month, year].filter((value, index) => index === 0 || value).join("/");
}

/** "01/11/2026" (or "1/11/26") as "2026-11-01"; undefined when it isn't a whole, real date. */
export function parseTypedDate(text: string): string | undefined {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text.trim());
  if (!match) return undefined;
  const [, day, month, shortOrLongYear] = match;
  const year = Number(shortOrLongYear!.length === 2 ? `20${shortOrLongYear}` : shortOrLongYear);
  const date = new Date(Date.UTC(year, Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== Number(month) - 1) return undefined;
  return date.toISOString().slice(0, 10);
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

/** "6.9600" → "6.96", "200.000" → "200", "100" stays "100": for prefilling inputs. */
export function trimDecimalZeros(value: string): string {
  return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
}
