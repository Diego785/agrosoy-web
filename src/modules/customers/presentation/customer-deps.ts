import "server-only";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import type { CustomerDeps } from "../application/customer-use-cases";
import { drizzleCustomerRepository } from "../infrastructure/drizzle-customer-repository";
import { drizzleZoneRepository } from "../infrastructure/drizzle-zone-repository";
import { identityTechnicianLookup } from "../infrastructure/identity-technician-lookup";

/** Composition root of the module: the use cases' ports bound to Postgres. */
export function customerDeps(executor: DbExecutor): CustomerDeps {
  return {
    customers: drizzleCustomerRepository(executor),
    zones: drizzleZoneRepository(executor),
    technicians: identityTechnicianLookup(executor),
    audit: drizzleAuditTrail(executor),
  };
}
