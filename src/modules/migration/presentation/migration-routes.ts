export const IMPORTS_PATH = "/imports";

export function importReviewPath(batchId: string): string {
  return `${IMPORTS_PATH}/${batchId}`;
}

export function importConversionPath(batchId: string): string {
  return `${importReviewPath(batchId)}/convert`;
}

export function reconciliationPath(batchId: string): string {
  return `${importReviewPath(batchId)}/reconciliation`;
}

/** What a converted sheet brought in for one customer besides notes, to correct it (D60). */
export function sheetEntriesPath(batchId: string, customerId: string): string {
  return `${reconciliationPath(batchId)}/${customerId}`;
}
