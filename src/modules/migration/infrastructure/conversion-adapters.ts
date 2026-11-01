import { and, eq, inArray } from "drizzle-orm";
import { addPresentation, createProduct } from "@/modules/catalog/application/catalog-use-cases";
import { drizzleProductRepository } from "@/modules/catalog/infrastructure/drizzle-catalog-repositories";
import { presentations, products } from "@/modules/catalog/infrastructure/catalog.tables";
import { registerCustomer } from "@/modules/customers/application/customer-use-cases";
import { customers } from "@/modules/customers/infrastructure/customers.tables";
import { drizzleCustomerRepository } from "@/modules/customers/infrastructure/drizzle-customer-repository";
import { drizzleZoneRepository } from "@/modules/customers/infrastructure/drizzle-zone-repository";
import { identityTechnicianLookup } from "@/modules/customers/infrastructure/identity-technician-lookup";
import type { Actor } from "@/shared/application/actor";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import type { CustomerRegistry, ExistingProduct, ProductRegistry } from "../application/conversion-ports";
import type { ConversionDeps } from "../application/conversion";
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

  const catalogDeps = { products: drizzleProductRepository(executor), audit };
  const productRegistry: ProductRegistry = {
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
                content: presentations.content,
                unit: presentations.unit,
              })
              .from(presentations)
              .where(
                and(
                  inArray(
                    presentations.productId,
                    productRows.map((row) => row.id),
                  ),
                  eq(presentations.isActive, true),
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
              .map(({ content, unit }) => ({ content, unit })),
          },
        ]),
      );
    },
    create(input) {
      return createProduct(catalogDeps, actor, input);
    },
    async addPresentation(productId, presentation) {
      await addPresentation(catalogDeps, actor, productId, presentation);
    },
  };

  return {
    imports: drizzleImportRepository(executor),
    customers: customerRegistry,
    products: productRegistry,
    technicians: identityTechnicianLookup(executor),
    audit,
  };
}
