export const STATEMENTS_PATH = "/statements";
export const STATEMENT_PREVIEWS_PATH = "/statements/preview";

/** A customer's statement from the ledger, optionally for one campaign. */
export function customerStatementPath(customerId: string, campaignId?: string): string {
  return `${STATEMENTS_PATH}/${customerId}${campaignId ? `?campaign=${campaignId}` : ""}`;
}

export function customerStatementPdfPath(customerId: string, campaignId?: string): string {
  return `${STATEMENTS_PATH}/${customerId}/pdf${campaignId ? `?campaign=${campaignId}` : ""}`;
}

/** The portfolio of an imported sheet (spreadsheet preview). */
export function previewPath(batchId: string): string {
  return `${STATEMENT_PREVIEWS_PATH}/${batchId}`;
}

export function customerPreviewPath(batchId: string, customerKey: string): string {
  return `${previewPath(batchId)}/${encodeURIComponent(customerKey)}`;
}
