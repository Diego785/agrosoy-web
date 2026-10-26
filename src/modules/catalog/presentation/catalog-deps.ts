import "server-only";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import type { CatalogDeps } from "../application/catalog-use-cases";
import { catalogLookups } from "../infrastructure/catalog-lookups";
import {
  drizzlePriceRepository,
  drizzleProductRepository,
} from "../infrastructure/drizzle-catalog-repositories";

/** Composition root of the module: the use cases' ports bound to Postgres. */
export function catalogDeps(executor: DbExecutor): CatalogDeps {
  return {
    products: drizzleProductRepository(executor),
    prices: drizzlePriceRepository(executor),
    lookups: catalogLookups(executor),
    audit: drizzleAuditTrail(executor),
  };
}
