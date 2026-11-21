// Loads Agrosoil's cleaned customer lists (one JSON, kept outside the repository: it holds personal
// data) through the use cases, so validation and the audit log apply. Running it again creates
// nothing twice: zones, technicians and customers that exist are left as they are.
//
//   corepack pnpm customers:load-lists --file clientes.json --as liz --passwords-out claves.txt
//   (in the container: node load-customer-lists.mjs --file … --as … --passwords-out …)
//
// The JSON: { technicians: [{ name, username, zone }], customers: [{ name, identityCard, taxId,
// phone, zone, locality, technician, usualPaymentTerms, notes, property }] }, where `technician` is
// a technician's name or null and `zone` a zone's name.
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import {
  addCustomerProperty,
  createZone,
  registerCustomer,
} from "@/modules/customers/application/customer-use-cases";
import { customers } from "@/modules/customers/infrastructure/customers.tables";
import { drizzleCustomerRepository } from "@/modules/customers/infrastructure/drizzle-customer-repository";
import { drizzleZoneRepository } from "@/modules/customers/infrastructure/drizzle-zone-repository";
import { identityTechnicianLookup } from "@/modules/customers/infrastructure/identity-technician-lookup";
import { createUser } from "@/modules/identity/application/user-use-cases";
import { users } from "@/modules/identity/infrastructure/auth.tables";
import { drizzleUserDirectory } from "@/modules/identity/infrastructure/drizzle-user-directory";
import { randomPasswordGenerator } from "@/modules/identity/infrastructure/random-password-generator";
import type { Actor } from "@/shared/application/actor";
import { effectivePermissions } from "@/shared/application/permissions";
import { isDomainError } from "@/shared/domain/domain-error";
import { normalizeForComparison } from "@/shared/domain/text";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { createDatabase, type DbExecutor } from "@/shared/infrastructure/db/client";

config({ path: ".env.local", quiet: true });

type Lists = {
  technicians: { name: string; username: string; zone: string }[];
  customers: {
    name: string;
    identityCard: string;
    taxId: string;
    phone: string;
    zone: string;
    locality: string;
    technician: string | null;
    usualPaymentTerms: "cash" | "credit" | null;
    notes: string;
    property: string;
  }[];
};

function customerDeps(executor: DbExecutor) {
  const audit = drizzleAuditTrail(executor);
  return {
    customers: drizzleCustomerRepository(executor),
    zones: drizzleZoneRepository(executor),
    technicians: identityTechnicianLookup(executor),
    audit,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      as: { type: "string" },
      "passwords-out": { type: "string" },
    },
  });
  if (!values.file || !values.as || !values["passwords-out"]) {
    throw new Error("Usage: --file lists.json --as <administrator's username> --passwords-out <file>");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const lists = JSON.parse(readFileSync(values.file, "utf8")) as Lists;

  const db = createDatabase(url);
  try {
    const [admin] = await db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.username, values.as.toLowerCase()));
    if (!admin || admin.role !== "admin") throw new Error(`No administrator with username ${values.as}`);
    const actor: Actor = {
      id: admin.id,
      name: admin.name,
      role: "admin",
      permissions: effectivePermissions("admin", []),
    };

    const summary = await db.transaction(async (tx) => {
      const deps = customerDeps(tx);
      // Zones by name, created when missing.
      const zoneIds = new Map(
        (await deps.zones.listAll()).map((zone) => [normalizeForComparison(zone.name), zone.id]),
      );
      const zoneOf = async (name: string) => {
        const key = normalizeForComparison(name);
        if (!zoneIds.has(key)) zoneIds.set(key, (await createZone(deps, actor, { name })).id);
        return zoneIds.get(key)!;
      };

      // Technicians by username, created when missing with a temporary password.
      const passwords: string[] = [];
      const technicianIds = new Map<string, string>();
      for (const technician of lists.technicians) {
        const [existing] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, technician.username));
        const id = existing
          ? existing.id
          : await createUser(
              {
                users: drizzleUserDirectory(tx),
                passwords: randomPasswordGenerator,
                audit: deps.audit,
                zones: deps.zones,
              },
              actor,
              {
                name: technician.name,
                username: technician.username,
                role: "sales_technician",
                position: "Técnico de venta",
                workZoneId: await zoneOf(technician.zone),
              },
            ).then(({ id: created, temporaryPassword }) => {
              passwords.push(`${technician.name}\t${technician.username}\t${temporaryPassword}`);
              return created;
            });
        technicianIds.set(technician.name, id);
      }

      let created = 0;
      const skipped: string[] = [];
      for (const customer of lists.customers) {
        const [existing] = await tx
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.comparisonName, normalizeForComparison(customer.name)));
        if (existing) {
          skipped.push(customer.name);
          continue;
        }
        const { id } = await registerCustomer(deps, actor, {
          name: customer.name,
          identityCard: customer.identityCard,
          taxId: customer.taxId,
          phone: customer.phone,
          zoneId: customer.zone ? await zoneOf(customer.zone) : "",
          locality: customer.locality,
          technicianId: customer.technician ? (technicianIds.get(customer.technician) ?? "") : "",
          usualPaymentTerms: customer.usualPaymentTerms ?? "",
          exchangeRateKind: "daily",
          notes: customer.notes,
        });
        if (customer.property) await addCustomerProperty(deps, actor, id, { name: customer.property });
        created += 1;
      }
      return { created, skipped, passwords };
    });

    writeFileSync(values["passwords-out"], summary.passwords.join("\n") + "\n", "utf8");
    console.log(`Customers created: ${summary.created}. Already there: ${summary.skipped.length}.`);
    if (summary.skipped.length > 0) console.log(`  Left as they were: ${summary.skipped.join(", ")}`);
    console.log(
      `Technicians created: ${summary.passwords.length}; their temporary passwords are in ${values["passwords-out"]}.`,
    );
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  const message = isDomainError(error)
    ? `${error.code}: ${JSON.stringify(error.details)}`
    : error instanceof Error
      ? error.message
      : error;
  console.error(message);
  process.exit(1);
});
