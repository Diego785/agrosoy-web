/** Writes go through the customers and catalog use cases, so their rules and audit apply. */

export type ExistingCustomer = { id: string; code: number; name: string };

export interface CustomerRegistry {
  /** Existing customers by comparison key (normalized name). */
  findByKeys(keys: string[]): Promise<Map<string, ExistingCustomer>>;
  register(input: { name: string; technicianId: string | null }): Promise<{ id: string }>;
}

export type PresentationSpec = {
  content: string;
  unit: "l" | "ml" | "kg" | "g" | "u";
  saleUnit: "container" | "measure";
};

export type ExistingProduct = {
  id: string;
  name: string;
  /** Content as stored ("20.000") and unit. */
  presentations: { content: string; unit: PresentationSpec["unit"] }[];
};

export interface ProductRegistry {
  findByKeys(keys: string[]): Promise<Map<string, ExistingProduct>>;
  create(input: {
    name: string;
    line: "agrochemicals" | "fertilizers";
    presentations: PresentationSpec[];
  }): Promise<{ id: string }>;
  addPresentation(productId: string, presentation: PresentationSpec): Promise<void>;
}

export interface TechnicianOptions {
  listActive(): Promise<{ id: string; name: string }[]>;
}
