import type { Season } from "@/modules/campaigns/domain/campaign";
import type { ExchangeRate } from "@/shared/domain/exchange-rate";
import type { Money } from "@/shared/domain/money";
import type { Allocation, CampaignBalance } from "../domain/allocation";
import type {
  ChargeConcept,
  ChargeDirection,
  ChargeRecord,
  PaymentMethod,
  PaymentRecord,
} from "../domain/payment";

export type DocumentStatus = "recorded" | "voided";

type CampaignRef = { id: string; season: Season; year: number };
type CustomerRef = { id: string; code: number; name: string };
/** byName is null when the user no longer exists. */
type VoidInfo = { at: Date; byName: string | null; reason: string } | null;

export type PaymentView = {
  id: string;
  receiptNumber: number;
  status: DocumentStatus;
  paymentDate: string;
  customer: CustomerRef & { taxId: string | null };
  currency: "USD" | "BOB";
  amount: string;
  exchangeRate: string;
  usdAmount: string;
  method: PaymentMethod;
  inKindDescription: string | null;
  reference: string | null;
  observations: string | null;
  concept: string | null;
  /** The customer's debt in US$ around this payment; null on payments from before they were kept (D27). */
  balance: { before: string; after: string } | null;
  settlesNote: { id: string; number: number | null } | null;
  allocations: {
    campaign: CampaignRef;
    note: { id: string; number: number | null } | null;
    usdAmount: string;
  }[];
  recorded: { at: Date; byName: string | null; documentId: string | null };
  voided: VoidInfo;
};

export type PaymentListItem = Pick<
  PaymentView,
  "id" | "receiptNumber" | "status" | "paymentDate" | "currency" | "amount" | "usdAmount" | "method"
> & { customerName: string };

export type ChargeView = {
  id: string;
  status: DocumentStatus;
  chargeDate: string;
  customer: CustomerRef;
  campaign: CampaignRef;
  usdAmount: string;
  concept: ChargeConcept;
  direction: ChargeDirection;
  reason: string;
  voided: VoidInfo;
};

/** `text` is already normalized for comparison; it matches the customer's name or the document's number. */
export type DocumentQuery = {
  text?: string;
  status?: DocumentStatus;
  limit: number;
  offset: number;
};

export interface PaymentRepository {
  insert(
    payment: PaymentRecord,
    allocations: readonly Allocation[],
    receiptNumber: number,
    createdBy: string,
    balance: { before: Money; after: Money },
  ): Promise<{ id: string }>;
  findById(id: string): Promise<PaymentView | undefined>;
  list(query: DocumentQuery & { customerId?: string }): Promise<{ items: PaymentListItem[]; total: number }>;
  receiptNumberInUse(number: number): Promise<boolean>;
  /** Recorded → voided. INVALID_STATE if it was already voided. */
  markVoided(id: string, reason: string, actorId: string): Promise<void>;
  /** Recorded payments received together with this cash note. */
  settling(noteId: string): Promise<string[]>;
}

export interface ChargeRepository {
  insert(charge: ChargeRecord, createdBy: string): Promise<{ id: string }>;
  findById(id: string): Promise<ChargeView | undefined>;
  list(query: DocumentQuery): Promise<{ items: ChargeView[]; total: number }>;
  markVoided(id: string, reason: string, actorId: string): Promise<void>;
}

export interface DailyRateRepository {
  rateOn(isoDate: string): Promise<string | undefined>;
  save(isoDate: string, rate: ExchangeRate, actorId: string): Promise<void>;
}

/** Facts from other modules a payment or charge needs. */
export interface CollectionLookups {
  customer(id: string): Promise<{ isActive: boolean; fixedExchangeRate: string | null } | undefined>;
  campaignOn(isoDate: string): Promise<{ id: string; status: "open" | "closed" } | undefined>;
  campaignStatus(id: string): Promise<"open" | "closed" | undefined>;
  /** A confirmed delivery note, to apply a payment to it. */
  confirmedNote(id: string): Promise<{ customerId: string; campaignId: string } | undefined>;
  /** What the customer owes per campaign, from the ledger. */
  balances(customerId: string): Promise<CampaignBalance[]>;
}
