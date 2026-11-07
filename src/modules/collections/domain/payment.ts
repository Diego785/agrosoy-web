import { DomainError } from "@/shared/domain/domain-error";
import type { ExchangeRate } from "@/shared/domain/exchange-rate";
import type { Currency, Money } from "@/shared/domain/money";

export const CURRENCIES = ["USD", "BOB"] as const satisfies readonly Currency[];

export const PAYMENT_METHODS = ["cash", "transfer", "qr", "in_kind"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** A payment received from a customer (M6). Debt is in dollars; the amount stays in the currency paid. */
export type PaymentRecord = {
  paymentDate: string;
  customerId: string;
  /** In the currency the customer paid. */
  amount: Money;
  exchangeRate: ExchangeRate;
  /** What the payment lowers the debt by. */
  usdAmount: Money;
  method: PaymentMethod;
  /** What was handed over when paying in kind (grain, for example) and its agreed value. */
  inKindDescription: string | null;
  reference: string | null;
  observations: string | null;
  /** What the receipt says it is for; without it, it says what the payment was applied to (D26). */
  concept: string | null;
  /** The cash note this payment was received with, voided together with it. */
  settlesNoteId: string | null;
};

/** Validates a payment and works out its dollar value: Bs ÷ rate, rounded half up to the cent (domain model, M6). */
export function paymentRecord(input: Omit<PaymentRecord, "usdAmount">): PaymentRecord {
  if (!input.amount.isPositive()) throw new DomainError("INVALID_AMOUNT", { reason: "not_positive" });
  if (input.method === "in_kind" && !input.inKindDescription) {
    throw new DomainError("VALIDATION_FAILED", { fieldErrors: { inKindDescription: ["required"] } });
  }
  const usdAmount = input.amount.currency === "USD" ? input.amount : input.exchangeRate.toUsd(input.amount);
  if (!usdAmount.isPositive()) throw new DomainError("INVALID_AMOUNT", { reason: "rounds_to_zero" });
  return { ...input, usdAmount };
}

/**
 * The payment of a cash note settles its total exactly. Paid in bolivianos it is the total at the
 * note's rate; the dollar value stays the note's total, so no rounding cent is left owing.
 */
export function cashNoteAmount(total: Money, rate: ExchangeRate, currency: Currency): Money {
  return currency === "USD" ? total : rate.toBob(total);
}

export function cashNotePayment(
  input: Omit<PaymentRecord, "amount" | "usdAmount" | "settlesNoteId"> & {
    total: Money;
    currency: Currency;
    noteId: string;
  },
): PaymentRecord {
  const { total, currency, noteId, ...payment } = input;
  const record = paymentRecord({
    ...payment,
    amount: cashNoteAmount(total, input.exchangeRate, currency),
    settlesNoteId: noteId,
  });
  return { ...record, usdAmount: total };
}

/** The "OTROS" codes of Agrosoil's product list: charges, not products (D24). */
export const CHARGE_CONCEPTS = ["interest", "price_adjustment", "notarized_contract", "other"] as const;
export type ChargeConcept = (typeof CHARGE_CONCEPTS)[number];

export const CHARGE_DIRECTIONS = ["debit", "credit"] as const;
export type ChargeDirection = (typeof CHARGE_DIRECTIONS)[number];

/** Only a price adjustment can lower the debt (D24). */
export function canLowerDebt(concept: ChargeConcept): boolean {
  return concept === "price_adjustment";
}

/** A movement administration enters on a customer's debt, always with its concept and reason. */
export type ChargeRecord = {
  chargeDate: string;
  customerId: string;
  campaignId: string;
  concept: ChargeConcept;
  direction: ChargeDirection;
  amount: Money;
  reason: string;
};

export function chargeRecord(input: ChargeRecord): ChargeRecord {
  if (input.direction === "credit" && !canLowerDebt(input.concept)) {
    throw new DomainError("VALIDATION_FAILED", { fieldErrors: { direction: ["not_allowed"] } });
  }
  if (!input.amount.isPositive()) throw new DomainError("INVALID_AMOUNT", { reason: "not_positive" });
  return input;
}

/** What the charge does to the debt: positive raises it, negative lowers it. */
export function chargeLedgerAmount(charge: Pick<ChargeRecord, "amount" | "direction">): Money {
  return charge.direction === "credit" ? charge.amount.negate() : charge.amount;
}
