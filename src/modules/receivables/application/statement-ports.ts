import type { ChargeConcept } from "@/modules/collections/domain/payment";
import type { Season } from "@/modules/campaigns/domain/campaign";
import type { ContentUnit } from "@/modules/catalog/domain/product";
import type { PaymentMethod } from "@/modules/collections/domain/payment";
import type { FreeReason } from "@/modules/sales/domain/delivery-note";
import type { Currency } from "@/shared/domain/money";
import type { LedgerKind, LedgerSource } from "../domain/ledger";

export type LedgerRow = {
  id: string;
  customerId: string;
  campaignId: string;
  date: string;
  kind: LedgerKind;
  amount: string;
  source: LedgerSource;
  reversesEntryId: string | null;
};

export type StatementCustomer = {
  id: string;
  code: number;
  name: string;
  /** Who looks after the customer today. */
  technicianId: string | null;
};

/** What splits the debt among technicians (D46): whose notes, which note a payment went to. */
export type ShareDetails = {
  /** Note id → its technician. */
  noteTechnicians: Map<string, string | null>;
  /** `${paymentId}|${campaignId}` → the note administration applied it to. */
  paidNotes: Map<string, string>;
  /** Charges that are interest. */
  interestCharges: Set<string>;
};

export type StatementCampaign = {
  id: string;
  season: Season;
  year: number;
  startsOn: string;
  /** When its debt falls due (D37). */
  dueOn: string;
};

/** A customer's later due date in one campaign (D37). */
export type StatementExtension = { customerId: string; campaignId: string; dueOn: string; reason: string };

export type NoteDetail = {
  number: number | null;
  exchangeRate: string | null;
  observations: string | null;
  taxInvoiceNumber: string | null;
  lines: {
    productName: string;
    content: string;
    unit: ContentUnit;
    quantity: string;
    unitPrice: string;
    freeOfCharge: FreeReason | null;
    total: string;
  }[];
};

export type PaymentDetail = {
  receiptNumber: number;
  method: PaymentMethod;
  currency: Currency;
  amount: string;
  /** The whole payment in dollars; its ledger entries split it per campaign (D20). */
  usdAmount: string;
  exchangeRate: string;
  reference: string | null;
};

/** Reads the ledger and the documents behind its entries, for statements. */
export interface StatementReader {
  entries(filter: { customerId?: string; campaignId?: string }): Promise<LedgerRow[]>;
  shareDetails(input: {
    noteIds: readonly string[];
    paymentIds: readonly string[];
    chargeIds: readonly string[];
  }): Promise<ShareDetails>;
  customers(ids: readonly string[]): Promise<StatementCustomer[]>;
  campaigns(): Promise<StatementCampaign[]>;
  extensions(customerIds: readonly string[]): Promise<StatementExtension[]>;
  notes(ids: readonly string[]): Promise<Map<string, NoteDetail>>;
  payments(ids: readonly string[]): Promise<Map<string, PaymentDetail>>;
  charges(ids: readonly string[]): Promise<Map<string, { reason: string; concept: ChargeConcept }>>;
  /** Opening balances (D29) by id, with the note administration wrote. */
  openingBalances(ids: readonly string[]): Promise<Map<string, { note: string | null }>>;
}
