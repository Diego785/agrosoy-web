import { eq, inArray } from "drizzle-orm";
import {
  addPresentation,
  createProduct,
  savePrices,
  updateProduct,
} from "@/modules/catalog/application/catalog-use-cases";
import { catalogLookups } from "@/modules/catalog/infrastructure/catalog-lookups";
import {
  drizzlePriceRepository,
  drizzleProductRepository,
} from "@/modules/catalog/infrastructure/drizzle-catalog-repositories";
import { presentations, products } from "@/modules/catalog/infrastructure/catalog.tables";
import { registerCustomer } from "@/modules/customers/application/customer-use-cases";
import { customers } from "@/modules/customers/infrastructure/customers.tables";
import { drizzleCustomerRepository } from "@/modules/customers/infrastructure/drizzle-customer-repository";
import { drizzleZoneRepository } from "@/modules/customers/infrastructure/drizzle-zone-repository";
import { identityTechnicianLookup } from "@/modules/customers/infrastructure/identity-technician-lookup";
import type { Actor } from "@/shared/application/actor";
import { DomainError } from "@/shared/domain/domain-error";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import type {
  CustomerRegistry,
  ExistingProduct,
  GeneralPrices,
  ProductRegistry,
} from "../application/conversion-ports";
import type { ConversionDeps } from "../application/conversion";
import type { ProductListDeps } from "../application/product-list-import";
import { exceljsWorkbookReader } from "./exceljs-workbook-reader";
import { drizzleImportRepository } from "./drizzle-import-repository";

/**
 * Wires the conversion to the customers and catalog modules. Lookups read their tables; writes call
 * their use cases on behalf of `actor`, so permissions, validation and audit stay theirs.
 */
export function conversionDeps(executor: DbExecutor, actor: Actor): ConversionDeps {
  const audit = drizzleAuditTrail(executor);

  const customerRegistry: CustomerRegistry = {
    async findByKeys(keys) {
      if (keys.length === 0) return new Map();
      const rows = await executor
        .select({
          id: customers.id,
          code: customers.code,
          name: customers.name,
          key: customers.comparisonName,
        })
        .from(customers)
        .where(inArray(customers.comparisonName, keys));
      return new Map(rows.map(({ key, ...customer }) => [key, customer]));
    },
    register({ name, technicianId }) {
      return registerCustomer(
        {
          customers: drizzleCustomerRepository(executor),
          zones: drizzleZoneRepository(executor),
          technicians: identityTechnicianLookup(executor),
          audit,
        },
        actor,
        { name, technicianId: technicianId ?? "", exchangeRateKind: "daily" },
      );
    },
  };

  return {
    imports: drizzleImportRepository(executor),
    customers: customerRegistry,
    products: productRegistry(executor, actor),
    technicians: identityTechnicianLookup(executor),
    audit,
  };
}

/** Agrosoil's product list: the catalog's products and its general reference prices. */
export function productListDeps(executor: DbExecutor, actor: Actor): ProductListDeps {
  const audit = drizzleAuditTrail(executor);
  const prices: GeneralPrices = {
    save(campaignId, rows) {
      return savePrices(
        {
          products: drizzleProductRepository(executor),
          prices: drizzlePriceRepository(executor),
          lookups: catalogLookups(executor),
          audit,
        },
        actor,
        { campaignId, zoneId: "", prices: rows },
      );
    },
    async current(campaignId) {
      const rows = await drizzlePriceRepository(executor).list(campaignId, null);
      return new Map(rows.map((row) => [row.presentationId, row.price]));
    },
  };
  return { workbooks: exceljsWorkbookReader, products: productRegistry(executor, actor), prices, audit };
}

function productRegistry(executor: DbExecutor, actor: Actor): ProductRegistry {
  const catalogDeps = { products: drizzleProductRepository(executor), audit: drizzleAuditTrail(executor) };
  return {
    async findByKeys(keys) {
      if (keys.length === 0) return new Map();
      const productRows = await executor
        .select({ id: products.id, name: products.name, key: products.comparisonName })
        .from(products)
        .where(inArray(products.comparisonName, keys));
      const presentationRows =
        productRows.length === 0
          ? []
          : await executor
              .select({
                productId: presentations.productId,
                id: presentations.id,
                code: presentations.code,
                content: presentations.content,
                unit: presentations.unit,
                saleUnit: presentations.saleUnit,
              })
              .from(presentations)
              // Deactivated presentations count too: adding them again would repeat them.
              .where(
                inArray(
                  presentations.productId,
                  productRows.map((row) => row.id),
                ),
              );
      return new Map(
        productRows.map((row): [string, ExistingProduct] => [
          row.key,
          {
            id: row.id,
            name: row.name,
            presentations: presentationRows
              .filter((presentation) => presentation.productId === row.id)
              .map(({ id, code, content, unit, saleUnit }) => ({ id, code, content, unit, saleUnit })),
          },
        ]),
      );
    },
    async findByCodes(codes) {
      if (codes.length === 0) return new Map();
      const rows = await executor
        .select({
          id: presentations.id,
          code: presentations.code,
          content: presentations.content,
          unit: presentations.unit,
          saleUnit: presentations.saleUnit,
          productId: products.id,
          productKey: products.comparisonName,
          productName: products.name,
        })
        .from(presentations)
        .innerJoin(products, eq(products.id, presentations.productId))
        .where(inArray(presentations.code, codes));
      return new Map(rows.map((row) => [row.code, row]));
    },
    create(input) {
      return createProduct(catalogDeps, actor, input);
    },
    async addPresentation(productId, presentation) {
      await addPresentation(catalogDeps, actor, productId, presentation);
    },
    async rename(productId, name) {
      const product = await catalogDeps.products.findById(productId);
      if (!product) throw new DomainError("NOT_FOUND", { entity: "product", id: productId });
      await updateProduct(catalogDeps, actor, productId, { name, line: product.line });
    },
  };
}
