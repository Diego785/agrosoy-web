export const CUSTOMERS_PATH = "/customers";
export const NEW_CUSTOMER_PATH = "/customers/new";
export const ZONES_PATH = "/customers/zones";

export function customerPath(customerId: string): string {
  return `${CUSTOMERS_PATH}/${customerId}`;
}

export function editCustomerPath(customerId: string): string {
  return `${customerPath(customerId)}/edit`;
}
