import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import type { Currency } from "@/shared/domain/money";
import { formatDocumentNumber, formatMoney } from "@/shared/presentation/format";
import type { PaymentView } from "../application/collection-ports";
import type { ChargeConcept, PaymentMethod } from "../domain/payment";

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  qr: "QR",
  in_kind: "En especie",
};

export const CURRENCY_LABELS: Record<Currency, string> = { USD: "Dólares (US$)", BOB: "Bolivianos (Bs)" };

export const CHARGE_CONCEPT_LABELS: Record<ChargeConcept, string> = {
  interest: "Interés",
  price_adjustment: "Ajuste de precio",
  notarized_contract: "Contrato notariado",
  other: "Otro cargo",
};

/** "US$ 1.250,00" or "Bs 8.700,00". */
export function formatAmount(currency: Currency, amount: string): string {
  return `${currency === "USD" ? "US$" : "Bs"} ${formatMoney(amount)}`;
}

/** What the receipt says it is for: what administration wrote, or what the payment was applied to (D26). */
export function paymentConcept(payment: Pick<PaymentView, "concept" | "allocations">): string {
  if (payment.concept) return payment.concept;
  const targets = payment.allocations.map((allocation) =>
    allocation.note?.number
      ? `boleta N.º ${formatDocumentNumber(allocation.note.number)}`
      : `campaña ${campaignLabel(allocation.campaign)}`,
  );
  return `Pago a cuenta de ${targets.join(", ")}`;
}
