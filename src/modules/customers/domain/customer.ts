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
  /** NIT, for invoices. */
  taxId?: string;
  /** CI of a person (D48). */
  identityCard?: string;
  phone?: string;
  /** Agrosoil's sales zone: Norte or Este (meeting of 7 November 2026). */
  zoneId?: string;
  /** The technician's own area within the zone, e.g. Yapacaní; information only. */
  locality?: string;
  /** The sales technician whose portfolio the customer belongs to. */
  technicianId?: string;
  exchangeRateAgreement: ExchangeRateAgreement;
  /** Cash or credit, suggested on new notes (D48). */
  usualPaymentTerms?: "cash" | "credit";
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
    identityCard: identityCard(details.identityCard),
    phone: optionalText(details.phone),
    zoneId: details.zoneId || undefined,
    locality: optionalText(details.locality),
    technicianId: details.technicianId || undefined,
    exchangeRateAgreement: details.exchangeRateAgreement,
    usualPaymentTerms: details.usualPaymentTerms,
    notes: optionalText(details.notes),
  };
}

/**
 * A CI as Agrosoil writes it: no spaces or dots, letters in capitals, and the hyphen kept, so a
 * foreigner's "E-13865035" and a complement like "1234567-1A" stay readable (D48).
 */
export function identityCard(value: string | undefined): string | undefined {
  const cleaned = optionalText(value)?.replace(/[\s.]/g, "").toUpperCase();
  return cleaned || undefined;
}
