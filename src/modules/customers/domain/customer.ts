import { DomainError } from "@/shared/domain/domain-error";
import type { ExchangeRate } from "@/shared/domain/exchange-rate";
import { cleanText, normalizeForComparison, optionalText } from "@/shared/domain/text";

/**
 * How a customer's payments in bolivianos are converted: at a rate fixed in their agreement, or
 * at the rate of the day the payment is made (docs/domain-model.md, Customers).
 */
export type ExchangeRateAgreement = { kind: "daily" } | { kind: "fixed"; rate: ExchangeRate };

export type CustomerDetails = {
  name: string;
  /** NIT or CI. */
  taxId?: string;
  phone?: string;
  zoneId?: string;
  /** The sales technician whose portfolio the customer belongs to. */
  technicianId?: string;
  exchangeRateAgreement: ExchangeRateAgreement;
  notes?: string;
};

export type CustomerRecord = Omit<CustomerDetails, "name"> & {
  name: string;
  /** Uniqueness key: two customers can't differ only in case, accents or spacing. */
  comparisonName: string;
};

/** Customer codes are numbers shown with four digits, like the paper records: 0042. */
export function formatCustomerCode(code: number): string {
  return String(code).padStart(4, "0");
}

export function customerRecord(details: CustomerDetails): CustomerRecord {
  const name = cleanText(details.name);
  if (name.length < 3) throw new DomainError("VALIDATION_FAILED", { fieldErrors: { name: ["too_short"] } });
  return {
    name,
    comparisonName: normalizeForComparison(name),
    taxId: optionalText(details.taxId)
      ?.replace(/[\s.-]/g, "")
      .toUpperCase(),
    phone: optionalText(details.phone),
    zoneId: details.zoneId || undefined,
    technicianId: details.technicianId || undefined,
    exchangeRateAgreement: details.exchangeRateAgreement,
    notes: optionalText(details.notes),
  };
}
