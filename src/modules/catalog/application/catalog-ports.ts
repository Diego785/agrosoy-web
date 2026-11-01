import type { Money } from "@/shared/domain/money";
import type {
  ContentUnit,
  PresentationRecord,
  ProductLine,
  ProductRecord,
  SaleUnit,
} from "../domain/product";

export type PresentationView = {
  id: string;
  /** "20.000" */
  content: string;
  unit: ContentUnit;
  saleUnit: SaleUnit;
};

export type ProductView = {
  id: string;
  code: number;
  name: string;
  line: ProductLine;
  presentations: PresentationView[];
};

export interface ProductRepository {
  /** Throws DomainError "DUPLICATE" (field "name"). */
  insert(product: ProductRecord, presentations: PresentationRecord[]): Promise<{ id: string; code: number }>;
  /** Same duplicate rule; NOT_FOUND when missing. */
  update(id: string, product: ProductRecord): Promise<void>;
  /** Throws DomainError "DUPLICATE" (field "content") when the product already has it. */
  addPresentation(productId: string, presentation: PresentationRecord): Promise<{ id: string }>;
  findById(id: string): Promise<ProductView | undefined>;
  /** Active products ordered by name; `text` is already normalized. */
  search(query: { text: string; line?: ProductLine }): Promise<ProductView[]>;
}

export type ReferencePrice = { presentationId: string; price: string };

/** Reference prices per campaign and zone; a null zone is the general price. */
export interface PriceRepository {
  list(campaignId: string, zoneId: string | null): Promise<ReferencePrice[]>;
  save(
    campaignId: string,
    zoneId: string | null,
    prices: { presentationId: string; price: Money | null }[],
    updatedBy: string,
  ): Promise<void>;
}

/** Lookups in other modules, so ids from the browser are checked before use. */
export type CatalogLookups = {
  campaignExists(id: string): Promise<boolean>;
  zoneExists(id: string): Promise<boolean>;
};
