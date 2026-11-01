export const IMPORTS_PATH = "/imports";

export function importReviewPath(batchId: string): string {
  return `${IMPORTS_PATH}/${batchId}`;
}

export function importConversionPath(batchId: string): string {
  return `${importReviewPath(batchId)}/convert`;
}
