import { z } from "zod";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import type { OfficialRate, OfficialRateSource } from "../application/collection-ports";

const OFFICIAL_RATE_URL = "https://bo.dolarapi.com/v1/dolares/oficial";
const TIMEOUT_MS = 3000;

const responseSchema = z.object({
  venta: z.number().positive(),
  fechaActualizacion: z.iso.datetime(),
});

/** The service's answer as a rate and its date; null if it isn't what we expect. */
export function parseOfficialRate(body: unknown): OfficialRate | null {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) return null;
  return {
    rate: ExchangeRate.parse(parsed.data.venta.toFixed(4)).toDecimalString(),
    // The service dates the rate at midnight UTC: the date as written is the rate's day.
    date: parsed.data.fechaActualizacion.slice(0, 10),
  };
}

/**
 * DolarApi republishes the central bank's rate and can lag it by a day, so the date goes with the
 * rate wherever it is shown. It is only a reference: if it fails, nothing else depends on it (D36).
 */
export const dolarApiOfficialRate: OfficialRateSource = {
  async latest() {
    try {
      const response = await fetch(OFFICIAL_RATE_URL, {
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      return response.ok ? parseOfficialRate(await response.json()) : null;
    } catch {
      return null;
    }
  },
};
