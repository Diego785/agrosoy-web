/** Writes go through the customers and catalog use cases, so their rules and audit apply. */

export type ExistingCustomer = { id: string; code: number; name: string };

export interface CustomerRegistry {
  /** Existing customers by comparison key (normalized name). */
  findByKeys(keys: string[]): Promise<Map<string, ExistingCustomer>>;
  register(input: { name: string; technicianId: string | null }): Promise<{ id: string }>;
}

export type PresentationSpec = {
  /** Agrosoy's code; without one the catalog gives the next free number. */
  code?: string;
  content: string;
  unit: "l" | "ml" | "kg" | "g" | "u";
  saleUnit: "container" | "measure";
};

export type ExistingPresentation = {
  id: string;
  code: string;
  /** Content as stored ("20.000"). */
  content: string;
  unit: PresentationSpec["unit"];
  saleUnit: PresentationSpec["saleUnit"];
};

export type ExistingProduct = {
  id: string;
  name: string;
  /** Active or not: adding a deactivated one again would repeat it. */
  presentations: ExistingPresentation[];
};

export interface ProductRegistry {
  findByKeys(keys: string[]): Promise<Map<string, ExistingProduct>>;
  /** Presentations by code, with the product they belong to. */
  findByCodes(
    codes: string[],
  ): Promise<Map<string, ExistingPresentation & { productKey: string; productName: string }>>;
  create(input: {
    name: string;
    line: "agrochemicals" | "fertilizers";
    presentations: PresentationSpec[];
  }): Promise<{ id: string }>;
  addPresentation(productId: string, presentation: PresentationSpec): Promise<void>;
}

/** The campaign's general reference prices (no zone), written through the catalog's use case. */
export interface GeneralPrices {
  /** Throws DomainError "NOT_FOUND" for an unknown campaign, even without prices. */
  save(campaignId: string, prices: { presentationId: string; price: string }[]): Promise<void>;
}

export interface TechnicianOptions {
  listActive(): Promise<{ id: string; name: string }[]>;
}

export interface CampaignLookup {
  find(id: string): Promise<{ id: string; status: "open" | "closed" } | undefined>;
}
