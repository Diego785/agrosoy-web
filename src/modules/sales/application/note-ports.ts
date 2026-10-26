import type { ContentUnit, SaleUnit } from "@/modules/catalog/domain/product";
import type { Season } from "@/modules/campaigns/domain/campaign";
import type { DraftNote, FreeReason, PaymentTerms } from "../domain/delivery-note";

export type NoteStatus = "draft" | "confirmed" | "voided";

export type NoteLineView = {
  presentationId: string;
  productName: string;
  content: string;
  unit: ContentUnit;
  saleUnit: SaleUnit;
  quantity: string;
  unitPrice: string;
  freeOfCharge: FreeReason | null;
  total: string;
};

export type NoteView = {
  id: string;
  status: NoteStatus;
  number: number | null;
  noteDate: string;
  customer: { id: string; code: number; name: string };
  property: { id: string; name: string } | null;
  campaign: { id: string; season: Season; year: number };
  technician: { id: string; name: string } | null;
  paymentTerms: PaymentTerms;
  exchangeRate: string;
  receiver: { name: string; documentId: string | null; relationship: string | null };
  observations: string | null;
  taxInvoiceNumber: string | null;
  lines: NoteLineView[];
  createdAt: Date;
  /** byName is null when the user no longer exists (imports run by scripts). */
  confirmed: { at: Date; byName: string | null } | null;
  voided: { at: Date; byName: string | null; reason: string } | null;
};

export type NoteListItem = {
  id: string;
  status: NoteStatus;
  number: number | null;
  noteDate: string;
  customerName: string;
  paymentTerms: PaymentTerms;
  total: string;
};

export interface NoteRepository {
  insertDraft(note: DraftNote, createdBy: string): Promise<{ id: string }>;
  /** Replaces header and lines of a draft. NOT_FOUND when it isn't a draft anymore. */
  replaceDraft(id: string, note: DraftNote): Promise<void>;
  /** Drafts can be discarded; confirmed notes are only voided (D6). NOT_FOUND otherwise. */
  deleteDraft(id: string): Promise<void>;
  findById(id: string): Promise<NoteView | undefined>;
  /** Draft → confirmed with its number. INVALID_STATE if it isn't a draft; DUPLICATE if the number is taken. */
  markConfirmed(id: string, number: number, actorId: string): Promise<void>;
  /** Confirmed → voided. INVALID_STATE if it isn't confirmed. */
  markVoided(id: string, reason: string, actorId: string): Promise<void>;
  numberInUse(number: number): Promise<boolean>;
  list(query: {
    status?: NoteStatus;
    limit: number;
    offset: number;
  }): Promise<{ items: NoteListItem[]; total: number }>;
}

/** Facts from other modules a note needs to be valid. */
export interface NoteLookups {
  customer(id: string): Promise<{ isActive: boolean; propertyIds: string[] } | undefined>;
  /** The open or closed campaign containing the date. */
  campaignOn(isoDate: string): Promise<{ id: string; status: "open" | "closed" } | undefined>;
  isActiveTechnician(id: string): Promise<boolean>;
  /** Which of these presentations exist and are active. */
  activePresentations(ids: string[]): Promise<Set<string>>;
}
