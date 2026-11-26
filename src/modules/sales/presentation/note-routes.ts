export const NOTES_PATH = "/notes";
export const NEW_NOTE_PATH = "/notes/new";

export function notePath(noteId: string): string {
  return `${NOTES_PATH}/${noteId}`;
}

export function notePdfPath(noteId: string): string {
  return `${notePath(noteId)}/pdf`;
}

export function editNotePath(noteId: string): string {
  return `${notePath(noteId)}/edit`;
}

export const RETURN_PATH = "/notes/return";
export const TRANSFER_PATH = "/notes/transfer";

/**
 * The return or transfer form (D25), for a customer's product from one campaign when they are known
 * (from a note's page), or to choose them first.
 */
export function followUpPath(
  mode: "return" | "transfer",
  target?: { customerId: string; campaignId: string },
): string {
  const path = mode === "return" ? RETURN_PATH : TRANSFER_PATH;
  return target ? `${path}?customer=${target.customerId}&campaign=${target.campaignId}` : path;
}

/** Correcting an imported note's prices or quantities (D60). */
export function correctNotePath(noteId: string): string {
  return `${notePath(noteId)}/correct`;
}
