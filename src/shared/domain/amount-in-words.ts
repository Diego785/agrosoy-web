import type { Currency, Money } from "./money";

const UNITS = [
  "",
  "UN",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE",
  "DIEZ",
  "ONCE",
  "DOCE",
  "TRECE",
  "CATORCE",
  "QUINCE",
  "DIECISÉIS",
  "DIECISIETE",
  "DIECIOCHO",
  "DIECINUEVE",
  "VEINTE",
  "VEINTIÚN",
  "VEINTIDÓS",
  "VEINTITRÉS",
  "VEINTICUATRO",
  "VEINTICINCO",
  "VEINTISÉIS",
  "VEINTISIETE",
  "VEINTIOCHO",
  "VEINTINUEVE",
];
const TENS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const HUNDREDS = [
  "",
  "CIENTO",
  "DOSCIENTOS",
  "TRESCIENTOS",
  "CUATROCIENTOS",
  "QUINIENTOS",
  "SEISCIENTOS",
  "SETECIENTOS",
  "OCHOCIENTOS",
  "NOVECIENTOS",
];

const CURRENCY_WORDS: Record<Currency, string> = {
  USD: "DÓLARES AMERICANOS",
  BOB: "BOLIVIANOS",
};

/** 1 to 999. "UN" rather than "UNO": every number here counts dollars or thousands. */
function belowThousand(value: number): string {
  if (value === 100) return "CIEN";
  const parts: string[] = [];
  if (value >= 100) parts.push(HUNDREDS[Math.floor(value / 100)]!);
  const rest = value % 100;
  if (rest > 0 && rest < 30) parts.push(UNITS[rest]!);
  if (rest >= 30) {
    const unit = rest % 10;
    parts.push(unit > 0 ? `${TENS[Math.floor(rest / 10)]!} Y ${UNITS[unit]!}` : TENS[Math.floor(rest / 10)]!);
  }
  return parts.join(" ");
}

function wholeInWords(value: bigint): string {
  if (value === 0n) return "CERO";
  const millions = value / 1_000_000n;
  const thousands = Number((value / 1000n) % 1000n);
  const units = Number(value % 1000n);
  const parts: string[] = [];
  if (millions > 0n) {
    parts.push(millions === 1n ? "UN MILLÓN" : `${wholeInWords(millions)} MILLONES`);
  }
  // Bolivian documents write "UN MIL", not "MIL", so a figure can't be altered in front of it.
  if (thousands > 0) parts.push(`${belowThousand(thousands)} MIL`);
  if (units > 0) parts.push(belowThousand(units));
  return parts.join(" ");
}

/** "UN MIL DOSCIENTOS CINCUENTA 50/100 DÓLARES AMERICANOS", as receipts and invoices write it. */
export function amountInWords(amount: Money): string {
  const [whole = "0", cents = "00"] = amount.toDecimalString().replace("-", "").split(".");
  return `${wholeInWords(BigInt(whole))} ${cents.padEnd(2, "0")}/100 ${CURRENCY_WORDS[amount.currency]}`;
}
