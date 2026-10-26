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

export type StatementCustomer = { id: string; code: number; name: string };

export type StatementCampaign = { id: string; season: Season; year: number; startsOn: string };

export type NoteDetail = {
  number: number | null;
  exchangeRate: string;
  observations: string | null;
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
  exchangeRate: string;
  reference: string | null;
};

/** Reads the ledger and the documents behind its entries, for statements. */
export interface StatementReader {
  entries(filter: { customerId?: string; campaignId?: string; technicianId?: string }): Promise<LedgerRow[]>;
  customers(ids: readonly string[]): Promise<StatementCustomer[]>;
  campaigns(): Promise<StatementCampaign[]>;
  notes(ids: readonly string[]): Promise<Map<string, NoteDetail>>;
  payments(ids: readonly string[]): Promise<Map<string, PaymentDetail>>;
  charges(ids: readonly string[]): Promise<Map<string, { reason: string }>>;
}
