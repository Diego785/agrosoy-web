import { formatScaled } from "@/shared/domain/decimal-text";
import { divideRoundingHalfUp } from "@/shared/domain/rounding";

/**
 * Turns a number read from a spreadsheet into a decimal string with at most `decimals` places.
 * Spreadsheet values are binary floats (8.83 is stored as 8.8299999…); 15 significant digits
 * recover what the person typed, and anything beyond `decimals` is rounded half up and reported.
 */
export function spreadsheetNumberToDecimal(
  value: number,
  decimals: number,
): { value: string; rounded: boolean } | undefined {
  if (!Number.isFinite(value)) return undefined;
  const typed = Number(value.toPrecision(15)).toString();
  if (/e/i.test(typed)) return undefined;

  const negative = typed.startsWith("-");
  const [whole = "0", fraction = ""] = typed.replace("-", "").split(".");
  const exact = BigInt(whole + fraction) * (negative ? -1n : 1n);
  const scale = 10n ** BigInt(fraction.length);
  const target = 10n ** BigInt(decimals);
  const scaled =
    fraction.length <= decimals ? exact * (target / scale) : divideRoundingHalfUp(exact * target, scale);
  return { value: formatScaled(scaled, decimals), rounded: fraction.length > decimals };
}
