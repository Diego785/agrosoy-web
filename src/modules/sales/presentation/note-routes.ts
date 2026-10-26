export const NOTES_PATH = "/notes";
export const NEW_NOTE_PATH = "/notes/new";

export function notePath(noteId: string): string {
  return `${NOTES_PATH}/${noteId}`;
}

export function editNotePath(noteId: string): string {
  return `${notePath(noteId)}/edit`;
}
