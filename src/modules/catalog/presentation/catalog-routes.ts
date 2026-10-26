export const PRODUCTS_PATH = "/products";
export const NEW_PRODUCT_PATH = "/products/new";
export const PRICES_PATH = "/prices";

export function productPath(productId: string): string {
  return `${PRODUCTS_PATH}/${productId}`;
}
