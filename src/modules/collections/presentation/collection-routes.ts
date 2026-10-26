export const PAYMENTS_PATH = "/payments";
export const NEW_PAYMENT_PATH = "/payments/new";
export const CHARGES_PATH = "/payments/charges";
export const NEW_CHARGE_PATH = "/payments/charges/new";

export function paymentPath(id: string): string {
  return `${PAYMENTS_PATH}/${id}`;
}

export function receiptPdfPath(paymentId: string): string {
  return `${paymentPath(paymentId)}/pdf`;
}

/** The payment form for one customer, with their balances and notes loaded. */
export function newPaymentPath(customerId: string): string {
  return `${NEW_PAYMENT_PATH}?customer=${customerId}`;
}
