/**
 * Converts between decimal strings ("-1234.5") and scaled integers (-123450 at 2 decimals).
 * Money, quantities and exchange rates all go through here, so none of them touches floats.
 */
export function parseScaled(
  value: string,
  decimals: number,
  { allowNegative = true } = {},
): bigint | undefined {
  const text = value.trim();
  const pattern = new RegExp(`^${allowNegative ? "-?" : ""}\\d+(\\.\\d{1,${decimals}})?$`);
  if (!pattern.test(text)) return undefined;

  const negative = text.startsWith("-");
  const [whole = "0", fraction = ""] = text.replace("-", "").split(".");
  const scaled = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0"));
  return negative ? -scaled : scaled;
}

export function formatScaled(scaled: bigint, decimals: number): string {
  const sign = scaled < 0n ? "-" : "";
  const absolute = scaled < 0n ? -scaled : scaled;
  const factor = 10n ** BigInt(decimals);
  const fraction = String(absolute % factor).padStart(decimals, "0");
  return `${sign}${absolute / factor}.${fraction}`;
}
