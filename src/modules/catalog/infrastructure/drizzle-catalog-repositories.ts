import { and, asc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { DomainError } from "@/shared/domain/domain-error";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import { violatedUniqueConstraint } from "@/shared/infrastructure/db/postgres-errors";
import type { PriceRepository, ProductRepository, ProductView } from "../application/catalog-ports";
import type { PresentationRecord } from "../domain/product";
import {
  PRESENTATION_KEY,
  PRODUCT_NAME_KEY,
  presentations,
  products,
  referencePrices,
} from "./catalog.tables";

export function drizzleProductRepository(executor: DbExecutor): ProductRepository {
  return {
    async insert(product, newPresentations) {
      const [row] = await withDuplicateCheck(() =>
        executor.insert(products).values(product).returning({ id: products.id, code: products.code }),
      );
      if (!row) throw new Error("Insert returned no product");
      await executor.insert(presentations).values(newPresentations.map((p) => presentationRow(row.id, p)));
      return row;
    },

    async update(id, product) {
      const rows = await withDuplicateCheck(() =>
        executor.update(products).set(product).where(eq(products.id, id)).returning({ id: products.id }),
      );
      if (rows.length === 0) throw new DomainError("NOT_FOUND", { entity: "product", id });
    },

    async addPresentation(productId, presentation) {
      const [row] = await withDuplicateCheck(() =>
        executor
          .insert(presentations)
          .values(presentationRow(productId, presentation))
          .returning({ id: presentations.id }),
      );
      if (!row) throw new Error("Insert returned no presentation");
      return row;
    },

    async findById(id) {
      const [product] = await withPresentations(executor, eq(products.id, id));
      return product;
    },

    search({ text, line }) {
      const conditions: (SQL | undefined)[] = [eq(products.isActive, true)];
      if (line) conditions.push(eq(products.line, line));
      if (text) {
        const pattern = `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
        const matches: SQL[] = [ilike(products.comparisonName, pattern)];
        if (/^\d{1,9}$/.test(text)) matches.push(eq(products.code, Number(text)));
        conditions.push(or(...matches));
      }
      return withPresentations(executor, and(...conditions));
    },
  };
}

async function withPresentations(executor: DbExecutor, where: SQL | undefined): Promise<ProductView[]> {
  const productRows = await executor
    .select()
    .from(products)
    .where(where)
    .orderBy(asc(products.comparisonName));
  if (productRows.length === 0) return [];
  const presentationRows = await executor
    .select()
    .from(presentations)
    .where(
      and(
        inArray(
          presentations.productId,
          productRows.map((product) => product.id),
        ),
        eq(presentations.isActive, true),
      ),
    )
    .orderBy(asc(presentations.unit), asc(presentations.content));
  return productRows.map((product) => ({
    id: product.id,
    code: product.code,
    name: product.name,
    line: product.line,
    presentations: presentationRows
      .filter((presentation) => presentation.productId === product.id)
      .map((presentation) => ({
        id: presentation.id,
        content: presentation.content,
        unit: presentation.unit,
        saleUnit: presentation.saleUnit,
      })),
  }));
}

function presentationRow(productId: string, presentation: PresentationRecord) {
  return {
    productId,
    content: presentation.content.toDecimalString(),
    unit: presentation.unit,
    saleUnit: presentation.saleUnit,
  };
}

async function withDuplicateCheck<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    const constraint = violatedUniqueConstraint(error);
    if (constraint === PRODUCT_NAME_KEY) throw new DomainError("DUPLICATE", { field: "name" });
    if (constraint === PRESENTATION_KEY) throw new DomainError("DUPLICATE", { field: "content" });
    throw error;
  }
}

export function drizzlePriceRepository(executor: DbExecutor): PriceRepository {
  const scope = (campaignId: string, zoneId: string | null) =>
    and(
      eq(referencePrices.campaignId, campaignId),
      zoneId === null ? isNull(referencePrices.zoneId) : eq(referencePrices.zoneId, zoneId),
    );

  return {
    list(campaignId, zoneId) {
      return executor
        .select({ presentationId: referencePrices.presentationId, price: referencePrices.price })
        .from(referencePrices)
        .where(scope(campaignId, zoneId));
    },

    async save(campaignId, zoneId, prices, updatedBy) {
      const removed = prices.filter((row) => row.price === null).map((row) => row.presentationId);
      if (removed.length > 0) {
        await executor
          .delete(referencePrices)
          .where(and(scope(campaignId, zoneId), inArray(referencePrices.presentationId, removed)));
      }
      const kept = prices.flatMap((row) =>
        row.price === null
          ? []
          : [
              {
                campaignId,
                zoneId,
                presentationId: row.presentationId,
                price: row.price.toDecimalString(),
                updatedBy,
              },
            ],
      );
      if (kept.length > 0) {
        await executor
          .insert(referencePrices)
          .values(kept)
          .onConflictDoUpdate({
            target: [referencePrices.campaignId, referencePrices.zoneId, referencePrices.presentationId],
            set: { price: sql`excluded.price`, updatedBy, updatedAt: sql`now()` },
          });
      }
    },
  };
}
