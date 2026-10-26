export const IMPORTS_PATH = "/imports";

export function importReviewPath(batchId: string): string {
  return `${IMPORTS_PATH}/${batchId}`;
}
