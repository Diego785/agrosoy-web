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
  /** "001" */
  code: string;
  /** "20.000" */
  content: string;
  unit: ContentUnit;
  saleUnit: SaleUnit;
  isActive: boolean;
};

export type ProductView = {
  id: string;
  name: string;
  line: ProductLine;
  isActive: boolean;
  presentations: PresentationView[];
};

export type ProductStatus = "active" | "inactive";

export interface ProductRepository {
  /** Throws DomainError "DUPLICATE" (field "name", or "code" when a presentation's code is taken). */
  insert(product: ProductRecord, presentations: PresentationRecord[]): Promise<{ id: string }>;
  /** Same duplicate rule; NOT_FOUND when missing. */
  update(id: string, product: ProductRecord): Promise<void>;
  /** Throws DomainError "DUPLICATE" (field "content" when the product has it, or "code"). */
  addPresentation(productId: string, presentation: PresentationRecord): Promise<{ id: string }>;
  /** The highest numeric presentation code in use, 0 when there is none. */
  highestPresentationCode(): Promise<number>;
  /** NOT_FOUND when missing. */
  setActive(id: string, isActive: boolean): Promise<void>;
  /** NOT_FOUND when the presentation isn't the product's. */
  setPresentationActive(productId: string, presentationId: string, isActive: boolean): Promise<void>;
  /** With every presentation, active or not. */
  findById(id: string): Promise<ProductView | undefined>;
  /**
   * Products ordered by name; `text` is already normalized and also matches presentation codes.
   * Active products come with their active presentations only; deactivated ones with all.
   */
  search(query: { text: string; line?: ProductLine; status?: ProductStatus }): Promise<ProductView[]>;
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
