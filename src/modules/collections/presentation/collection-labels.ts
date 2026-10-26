import type { Currency } from "@/shared/domain/money";
import { formatMoney } from "@/shared/presentation/format";
import type { PaymentMethod } from "../domain/payment";

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  qr: "QR",
  in_kind: "En especie",
};

export const CURRENCY_LABELS: Record<Currency, string> = { USD: "Dólares (US$)", BOB: "Bolivianos (Bs)" };

/** "US$ 1.250,00" or "Bs 8.700,00". */
export function formatAmount(currency: Currency, amount: string): string {
  return `${currency === "USD" ? "US$" : "Bs"} ${formatMoney(amount)}`;
}
