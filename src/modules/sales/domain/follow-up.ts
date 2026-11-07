import { DomainError } from "@/shared/domain/domain-error";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";
import type { DraftNote, FreeReason } from "./delivery-note";

export const NOTE_TYPES = ["delivery", "return", "campaign_transfer"] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

/**
 * Returns and campaign transfers act on the lines of a confirmed delivery note (domain model, M5).
 * Each original line can be returned or moved to another campaign only up to what is left of it.
 */
export type OriginalLine = {
  id: string;
  presentationId: string;
  quantity: Quantity;
  unitPrice: Money;
  freeOfCharge: FreeReason | null;
  /** Already returned or transferred by confirmed follow-up notes. */
  settled: Quantity;
};

export type FollowUpLine = {
  originalLineId: string;
  presentationId: string;
  quantity: Quantity;
  /** Returns: the original price. Transfers: the price in the new campaign. */
  unitPrice: Money;
  freeOfCharge: FreeReason | null;
  /** What the line is worth at its unit price. */
  total: Money;
  /** Transfers: what the line was worth at the original price, credited in the old campaign. */
  originalTotal: Money;
};

export function remaining(line: OriginalLine): Quantity {
  return line.quantity.subtract(line.settled);
}

type Requested = { originalLineId: string; quantity: Quantity };

/** Checks every requested quantity against what is left of its line; lines with zero are skipped. */
function chosenLines(original: readonly OriginalLine[], requested: readonly Requested[]) {
  const byId = new Map(original.map((line) => [line.id, line]));
  const fieldErrors: Record<string, string[]> = {};
  const chosen: { line: OriginalLine; quantity: Quantity }[] = [];
  requested.forEach((request, index) => {
    const line = byId.get(request.originalLineId);
    if (!line) {
      fieldErrors[`lines.${index}.quantity`] = ["not_in_note"];
      return;
    }
    if (request.quantity.isZero()) return;
    if (request.quantity.compare(remaining(line)) > 0) {
      fieldErrors[`lines.${index}.quantity`] = ["exceeds_remaining"];
      return;
    }
    chosen.push({ line, quantity: request.quantity });
  });
  if (Object.keys(fieldErrors).length > 0) throw new DomainError("VALIDATION_FAILED", { fieldErrors });
  if (chosen.length === 0)
    throw new DomainError("VALIDATION_FAILED", { fieldErrors: { lines: ["no_lines"] } });
  return chosen;
}

/** A return credits each line at the price it was delivered for; free lines credit nothing. */
export function returnLines(
  original: readonly OriginalLine[],
  requested: readonly Requested[],
): FollowUpLine[] {
  return chosenLines(original, requested).map(({ line, quantity }) => {
    const total = line.freeOfCharge ? Money.zero() : quantity.times(line.unitPrice);
    return {
      originalLineId: line.id,
      presentationId: line.presentationId,
      quantity,
      unitPrice: line.unitPrice,
      freeOfCharge: line.freeOfCharge,
      total,
      originalTotal: total,
    };
  });
}

/**
 * A transfer moves product the customer still holds to a new campaign: credited at the old price
 * in the old campaign, charged at the new price in the new one. Free products owe nothing, so
 * there is nothing to move.
 */
export function transferLines(
  original: readonly OriginalLine[],
  requested: readonly (Requested & { unitPrice: Money })[],
): FollowUpLine[] {
  const prices = new Map(requested.map((request) => [request.originalLineId, request.unitPrice]));
  return chosenLines(original, requested).map(({ line, quantity }) => {
    if (line.freeOfCharge) {
      throw new DomainError("VALIDATION_FAILED", { fieldErrors: { lines: ["free_not_transferable"] } });
    }
    const unitPrice = prices.get(line.id) ?? Money.zero();
    if (!unitPrice.isPositive()) throw new DomainError("INVALID_AMOUNT", { reason: "price_required" });
    return {
      originalLineId: line.id,
      presentationId: line.presentationId,
      quantity,
      unitPrice,
      freeOfCharge: null,
      total: quantity.times(unitPrice),
      originalTotal: quantity.times(line.unitPrice),
    };
  });
}

/**
 * A return or a campaign transfer, saved already confirmed. It keeps the original's customer,
 * property and technician; a return stays in the original's campaign, a transfer moves to the
 * campaign of its own date.
 */
export type FollowUpNote = Omit<DraftNote, "lines" | "taxInvoiceNumber"> & {
  type: Exclude<NoteType, "delivery">;
  originalNoteId: string;
  lines: FollowUpLine[];
};
