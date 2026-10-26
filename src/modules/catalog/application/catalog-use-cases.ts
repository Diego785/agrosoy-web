import { z } from "zod";
import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";
import { normalizeForComparison } from "@/shared/domain/text";
import { productRecord, type PresentationRecord } from "../domain/product";
import type {
  CatalogLookups,
  PresentationView,
  PriceRepository,
  ProductRepository,
  ProductView,
} from "./catalog-ports";
import {
  newProductSchema,
  presentationSchema,
  priceSheetSchema,
  productSchema,
  productSearchSchema,
  savePricesSchema,
} from "./catalog-schemas";

export type CatalogDeps = {
  products: ProductRepository;
  prices: PriceRepository;
  lookups: CatalogLookups;
  audit: AuditTrail;
};

export async function createProduct(
  deps: Pick<CatalogDeps, "products" | "audit">,
  actor: Actor,
  input: unknown,
): Promise<{ id: string; code: number }> {
  assertCan(actor, "catalog.manage");
  const data = validateInput(newProductSchema, input);
  const product = productRecord(data.name, data.line);
  const presentations = data.presentations.map(presentationRecord);

  const created = await deps.products.insert(product, presentations);
  await deps.audit.record({
    actorId: actor.id,
    action: "catalog.create_product",
    entityType: "product",
    entityId: created.id,
    payload: { ...product, presentations: data.presentations },
  });
  return created;
}

export async function updateProduct(
  deps: Pick<CatalogDeps, "products" | "audit">,
  actor: Actor,
  productId: unknown,
  input: unknown,
): Promise<void> {
  assertCan(actor, "catalog.manage");
  const id = validateInput(z.uuid(), productId);
  const data = validateInput(productSchema, input);
  const product = productRecord(data.name, data.line);

  await deps.products.update(id, product);
  await deps.audit.record({
    actorId: actor.id,
    action: "catalog.update_product",
    entityType: "product",
    entityId: id,
    payload: product,
  });
}

export async function addPresentation(
  deps: Pick<CatalogDeps, "products" | "audit">,
  actor: Actor,
  productId: unknown,
  input: unknown,
): Promise<{ id: string }> {
  assertCan(actor, "catalog.manage");
  const product = await findProduct(deps.products, productId);
  const data = validateInput(presentationSchema, input);

  const created = await deps.products.addPresentation(product.id, presentationRecord(data));
  await deps.audit.record({
    actorId: actor.id,
    action: "catalog.add_presentation",
    entityType: "product",
    entityId: product.id,
    payload: { name: product.name, ...data },
  });
  return created;
}

export async function listProducts(
  deps: Pick<CatalogDeps, "products">,
  actor: Actor,
  input: unknown,
): Promise<ProductView[]> {
  assertCan(actor, "catalog.view");
  const { text, line } = validateInput(productSearchSchema, input);
  return deps.products.search({ text: normalizeForComparison(text), line });
}

export async function getProduct(
  deps: Pick<CatalogDeps, "products">,
  actor: Actor,
  productId: unknown,
): Promise<ProductView> {
  assertCan(actor, "catalog.view");
  return findProduct(deps.products, productId);
}

export type PriceSheetRow = { product: ProductView; presentation: PresentationView; price: string | null };

/** Every presentation with its reference price for one campaign and zone (or the general price). */
export async function priceSheet(
  deps: Pick<CatalogDeps, "products" | "prices">,
  actor: Actor,
  input: unknown,
): Promise<PriceSheetRow[]> {
  assertCan(actor, "catalog.view");
  const { campaignId, zoneId } = validateInput(priceSheetSchema, input);
  const [products, prices] = await Promise.all([
    deps.products.search({ text: "" }),
    deps.prices.list(campaignId, zoneId || null),
  ]);
  const byPresentation = new Map(prices.map((row) => [row.presentationId, row.price]));
  return products.flatMap((product) =>
    product.presentations.map((presentation) => ({
      product,
      presentation,
      price: byPresentation.get(presentation.id) ?? null,
    })),
  );
}

export async function savePrices(deps: CatalogDeps, actor: Actor, input: unknown): Promise<void> {
  assertCan(actor, "catalog.manage");
  const { campaignId, zoneId, prices } = validateInput(savePricesSchema, input);
  if (!(await deps.lookups.campaignExists(campaignId))) {
    throw new DomainError("NOT_FOUND", { entity: "campaign", id: campaignId });
  }
  if (zoneId && !(await deps.lookups.zoneExists(zoneId))) {
    throw new DomainError("NOT_FOUND", { entity: "zone", id: zoneId });
  }

  await deps.prices.save(
    campaignId,
    zoneId || null,
    prices.map((row) => ({
      presentationId: row.presentationId,
      price: row.price ? Money.parse(row.price) : null,
    })),
    actor.id,
  );
  await deps.audit.record({
    actorId: actor.id,
    action: "catalog.save_prices",
    entityType: "campaign",
    entityId: campaignId,
    payload: { zoneId: zoneId || null, prices },
  });
}

/**
 * The suggested price for a note line: the zone's own price, or else the general one. The
 * technician still records the negotiated price on the line.
 */
export async function referencePrice(
  deps: Pick<CatalogDeps, "prices">,
  query: { campaignId: string; zoneId: string | null; presentationId: string },
): Promise<string | null> {
  const find = async (zoneId: string | null) =>
    (await deps.prices.list(query.campaignId, zoneId)).find(
      (row) => row.presentationId === query.presentationId,
    )?.price ?? null;
  return (query.zoneId ? await find(query.zoneId) : null) ?? (await find(null));
}

function presentationRecord(data: z.output<typeof presentationSchema>): PresentationRecord {
  return { content: Quantity.parse(data.content), unit: data.unit, saleUnit: data.saleUnit };
}

async function findProduct(products: ProductRepository, productId: unknown): Promise<ProductView> {
  const id = validateInput(z.uuid(), productId);
  const product = await products.findById(id);
  if (!product) throw new DomainError("NOT_FOUND", { entity: "product", id });
  return product;
}
