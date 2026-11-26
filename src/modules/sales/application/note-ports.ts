import type { ContentUnit, SaleUnit } from "@/modules/catalog/domain/product";
import type { Season } from "@/modules/campaigns/domain/campaign";
import type { Carrier, DraftNote, FreeReason, ImportedNote, PaymentTerms } from "../domain/delivery-note";
import type { FollowUpNote, NoteType, OriginalLine } from "../domain/follow-up";
import type { Money } from "@/shared/domain/money";
import type { Quantity } from "@/shared/domain/quantity";
import type { UnitPrice } from "@/shared/domain/unit-price";

export type NoteStatus = "draft" | "confirmed" | "voided";

export type NoteLineView = {
  id: string;
  presentationId: string;
  productName: string;
  content: string;
  unit: ContentUnit;
  saleUnit: SaleUnit;
  quantity: string;
  unitPrice: string;
  freeOfCharge: FreeReason | null;
  total: string;
  /** Returns and transfers: the note whose line this one gives back or moves (D25). */
  sourceNoteId: string | null;
};

/** A note a return or transfer draws from, as its header and PDF name it (D25). */
export type NoteSource = {
  id: string;
  type: NoteType;
  number: number | null;
  /** The number the spreadsheet gave it, for imported notes. */
  sheetNumber: number | null;
  imported: boolean;
  noteDate: string;
  campaign: { season: Season; year: number };
};

/** A line the customer received in a campaign, with what is left of it to return or move (D25). */
export type ConsignedLine = OriginalLine & {
  source: Omit<NoteSource, "campaign"> & {
    propertyId: string | null;
    technicianId: string | null;
    paymentTerms: PaymentTerms;
    exchangeRate: string | null;
  };
  productName: string;
  content: string;
  unit: ContentUnit;
  saleUnit: SaleUnit;
};

export type NoteView = {
  id: string;
  type: NoteType;
  status: NoteStatus;
  number: number | null;
  /** Brought in from a spreadsheet, with the number the sheet gave it. */
  imported: { sheetNumber: number | null } | null;
  /** Returns and transfers: the notes their lines come from, oldest first (D25). */
  sources: NoteSource[];
  noteDate: string;
  customer: { id: string; code: number; name: string; taxId: string | null };
  property: { id: string; name: string } | null;
  campaign: { id: string; season: Season; year: number };
  technician: { id: string; name: string } | null;
  paymentTerms: PaymentTerms;
  /** Null when it is agreed at payment (D35). */
  exchangeRate: string | null;
  receiver: { name: string; documentId: string | null; relationship: string | null };
  handedOverBy: { id: string; name: string; position: string | null; documentId: string | null } | null;
  carrier: Carrier;
  observations: string | null;
  taxInvoiceNumber: string | null;
  lines: NoteLineView[];
  createdAt: Date;
  /** byName is null when the user no longer exists (imports run by scripts). */
  confirmed: { at: Date; byName: string | null } | null;
  voided: { at: Date; byName: string | null; reason: string } | null;
  /** The last time administration corrected an imported note's prices or quantities (D60). */
  corrected: { at: Date; byName: string | null; reason: string } | null;
};

/** A line of an imported note as a correction leaves it (D60). */
export type CorrectedLine = { id: string; quantity: Quantity; unitPrice: UnitPrice; total: Money };

/** A return or transfer that took product from a note. */
export type FollowUpItem = {
  id: string;
  type: NoteType;
  status: NoteStatus;
  number: number | null;
  noteDate: string;
};

export type NoteListItem = {
  id: string;
  type: NoteType;
  status: NoteStatus;
  /** The system's number, or the sheet's for imported notes. */
  number: number | null;
  imported: boolean;
  noteDate: string;
  customerName: string;
  technicianName: string | null;
  paymentTerms: PaymentTerms;
  total: string;
};

/** A confirmed delivery note one invoice can cover (D40). */
export type InvoiceCandidate = {
  id: string;
  /** The system's number, or the sheet's for imported notes. */
  number: number | null;
  imported: boolean;
  noteDate: string;
  total: string;
  taxInvoiceNumber: string | null;
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
  /** Rewrites lines of a confirmed imported note. INVALID_STATE when it isn't one any more. */
  correctLines(id: string, lines: readonly CorrectedLine[], reason: string, actorId: string): Promise<void>;
  /** Any note has the number, voided ones included: the counter never gives it again. */
  numberInUse(number: number): Promise<boolean>;
  /** A note that isn't voided has the number; a voided note's printed number can be typed again (D28). */
  numberTaken(number: number): Promise<boolean>;
  /**
   * The lines a customer received in a campaign, from confirmed deliveries and transfers into it,
   * with what confirmed returns and transfers already took from each; oldest first (D25).
   */
  consignedLines(customerId: string, campaignId: string): Promise<ConsignedLine[]>;
  /** The returns and transfers that took product from this note's lines. */
  followUps(noteId: string): Promise<FollowUpItem[]>;
  /** Saves a return or transfer as confirmed, with its number. DUPLICATE if the number is taken. */
  insertFollowUp(note: FollowUpNote, number: number, actorId: string): Promise<{ id: string }>;
  insertImported(note: ImportedNote, actorId: string): Promise<{ id: string }>;
  /** Confirmed notes brought in from one import batch. */
  importedFrom(batchId: string): Promise<{ id: string }[]>;
  /** A customer's confirmed delivery notes in one campaign, oldest first. */
  invoiceCandidates(customerId: string, campaignId: string): Promise<InvoiceCandidate[]>;
  /** Writes or clears the SIN invoice number of confirmed delivery notes. */
  setTaxInvoiceNumber(ids: readonly string[], value: string | null): Promise<void>;
  list(query: {
    /** Compared normalized (case and accents ignored); a number also matches note and customer numbers. */
    text?: string;
    /** Without one, every note except voided ones; "all" includes them. */
    status?: NoteStatus | "all";
    customerId?: string;
    from?: string;
    to?: string;
    limit: number;
    offset: number;
  }): Promise<{ items: NoteListItem[]; total: number }>;
}

/** Facts from other modules a note needs to be valid. */
export interface NoteLookups {
  customer(
    id: string,
  ): Promise<
    { name: string; isActive: boolean; propertyIds: string[]; technicianId: string | null } | undefined
  >;
  /** The open or closed campaign containing the date. */
  campaignOn(isoDate: string): Promise<{ id: string; status: "open" | "closed" } | undefined>;
  /** The campaigns a note of that date can belong to, the date's own first (D37). */
  noteCampaigns(isoDate: string): Promise<{ id: string; status: "open" | "closed" }[]>;
  isActiveTechnician(id: string): Promise<boolean>;
  /** Any active user can hand the product over (technician, warehouse keeper…). */
  isActiveUser(id: string): Promise<boolean>;
  /** Which of these presentations exist and are active. */
  activePresentations(ids: string[]): Promise<Set<string>>;
}
