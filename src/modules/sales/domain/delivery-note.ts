import { DomainError } from "@/shared/domain/domain-error";
import type { ExchangeRate } from "@/shared/domain/exchange-rate";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";

export const PAYMENT_TERMS = ["cash", "credit"] as const;
export type PaymentTerms = (typeof PAYMENT_TERMS)[number];

/** Free-of-charge lines take stock but create no debt (domain model, M5). */
export const FREE_REASONS = ["bonus", "sample"] as const;
export type FreeReason = (typeof FREE_REASONS)[number];

export type NoteLine = {
  presentationId: string;
  quantity: Quantity;
  unitPrice: Money;
  freeOfCharge: FreeReason | null;
};

export type DraftNote = {
  noteDate: string;
  customerId: string;
  propertyId: string | null;
  campaignId: string;
  technicianId: string | null;
  paymentTerms: PaymentTerms;
  exchangeRate: ExchangeRate;
  receiver: { name: string; documentId: string | null; relationship: string | null };
  handedOverById: string | null;
  carrier: Carrier;
  observations: string | null;
  taxInvoiceNumber: string | null;
  lines: NoteLine[];
};

export type Carrier = { name: string | null; vehicle: string | null; documentId: string | null };

export function noteLine(input: {
  presentationId: string;
  quantity: Quantity;
  unitPrice: Money;
  freeOfCharge: FreeReason | null;
}): NoteLine {
  if (!input.quantity.isPositive()) {
    throw new DomainError("INVALID_QUANTITY", { reason: "not_positive" });
  }
  if (input.freeOfCharge) return { ...input, unitPrice: Money.zero() };
  // A zero price without a reason is how the spreadsheet hid gifts ("SV"); the note must say why.
  if (!input.unitPrice.isPositive()) throw new DomainError("INVALID_AMOUNT", { reason: "price_required" });
  return input;
}

export function lineTotal(line: Pick<NoteLine, "quantity" | "unitPrice" | "freeOfCharge">): Money {
  return line.freeOfCharge ? Money.zero() : line.quantity.times(line.unitPrice);
}

export function noteTotal(lines: readonly NoteLine[]): Money {
  return Money.sum(lines.map(lineTotal));
}

export function draftNote(input: DraftNote): DraftNote {
  if (input.lines.length === 0) {
    throw new DomainError("VALIDATION_FAILED", { fieldErrors: { lines: ["no_lines"] } });
  }
  return input;
}

/**
 * A sale brought in from a spreadsheet (M12): already confirmed, with the sheet's number (which
 * may repeat) and its lines as written, a zero price included, since nothing says why.
 */
export type ImportedNote = {
  importBatchId: string;
  sheetNumber: number | null;
  noteDate: string;
  customerId: string;
  campaignId: string;
  exchangeRate: ExchangeRate;
  receiverName: string;
  observations: string | null;
  lines: { presentationId: string; quantity: Quantity; unitPrice: Money; total: Money }[];
};
