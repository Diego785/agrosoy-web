import { cleanText, optionalText } from "@/shared/domain/text";

/** A farm or estate of the customer; a delivery note can name where the product goes. */
export type PropertyRecord = { name: string; location?: string };

/**
 * Someone who may receive product for the customer. Their CI and position or kinship are legal
 * proof of receipt when a customer says the product never arrived (discovery meeting).
 */
export type ReceiverRecord = { name: string; documentId?: string; relationship: string };

export function propertyRecord(input: { name: string; location?: string }): PropertyRecord {
  return { name: cleanText(input.name), location: optionalText(input.location) };
}

export function receiverRecord(input: {
  name: string;
  documentId?: string;
  relationship: string;
}): ReceiverRecord {
  return {
    name: cleanText(input.name),
    documentId: optionalText(input.documentId)
      ?.replace(/[\s.-]/g, "")
      .toUpperCase(),
    relationship: cleanText(input.relationship),
  };
}
