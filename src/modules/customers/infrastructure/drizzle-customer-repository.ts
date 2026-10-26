import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { users } from "@/modules/identity/infrastructure/auth.tables";
import { DomainError } from "@/shared/domain/domain-error";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import { violatedUniqueConstraint } from "@/shared/infrastructure/db/postgres-errors";
import type { CustomerQuery, CustomerRepository } from "../application/ports";
import type { CustomerRecord } from "../domain/customer";
import { CUSTOMER_NAME_KEY, customers, zones } from "./customers.tables";

export function drizzleCustomerRepository(executor: DbExecutor): CustomerRepository {
  return {
    async insert(customer) {
      const [row] = await withDuplicateCheck(() =>
        executor
          .insert(customers)
          .values(toRow(customer))
          .returning({ id: customers.id, code: customers.code }),
      );
      if (!row) throw new Error("Insert returned no customer");
      return row;
    },

    async update(id, customer) {
      const updated = await withDuplicateCheck(() =>
        executor
          .update(customers)
          .set(toRow(customer))
          .where(eq(customers.id, id))
          .returning({ id: customers.id }),
      );
      if (updated.length === 0) throw new DomainError("NOT_FOUND", { entity: "customer", id });
    },

    async findForEdit(id) {
      const [row] = await executor.select().from(customers).where(eq(customers.id, id));
      if (!row) return undefined;
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        taxId: row.taxId,
        phone: row.phone,
        zoneId: row.zoneId,
        technicianId: row.technicianId,
        exchangeRateKind: row.exchangeRateKind,
        fixedExchangeRate: row.fixedExchangeRate,
        notes: row.notes,
      };
    },

    async search(query) {
      const where = searchFilter(query);
      // `is not distinct from` is never null, so customers without a technician don't sort first.
      const ownFirst = query.preferTechnicianId
        ? [desc(sql`${customers.technicianId} is not distinct from ${query.preferTechnicianId}`)]
        : [];
      const [items, totals] = await Promise.all([
        executor
          .select({
            id: customers.id,
            code: customers.code,
            name: customers.name,
            taxId: customers.taxId,
            phone: customers.phone,
            zoneName: zones.name,
            technicianName: users.name,
          })
          .from(customers)
          .leftJoin(zones, eq(zones.id, customers.zoneId))
          .leftJoin(users, eq(users.id, customers.technicianId))
          .where(where)
          .orderBy(...ownFirst, asc(customers.comparisonName))
          .limit(query.limit)
          .offset(query.offset),
        executor.select({ total: count() }).from(customers).where(where),
      ]);
      return { items, total: totals[0]?.total ?? 0 };
    },
  };
}

function toRow(customer: CustomerRecord) {
  const { exchangeRateAgreement, ...rest } = customer;
  return {
    ...rest,
    // Explicit nulls so an update clears fields that were emptied in the form.
    taxId: rest.taxId ?? null,
    phone: rest.phone ?? null,
    zoneId: rest.zoneId ?? null,
    technicianId: rest.technicianId ?? null,
    notes: rest.notes ?? null,
    exchangeRateKind: exchangeRateAgreement.kind,
    fixedExchangeRate:
      exchangeRateAgreement.kind === "fixed" ? exchangeRateAgreement.rate.toDecimalString() : null,
  };
}

async function withDuplicateCheck<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (violatedUniqueConstraint(error) === CUSTOMER_NAME_KEY) {
      throw new DomainError("DUPLICATE", { field: "name" });
    }
    throw error;
  }
}

function searchFilter({ text, zoneId }: CustomerQuery): SQL | undefined {
  const conditions: (SQL | undefined)[] = [eq(customers.isActive, true)];
  if (zoneId) conditions.push(eq(customers.zoneId, zoneId));
  if (text) {
    const pattern = `%${escapeLike(text)}%`;
    const matches: SQL[] = [ilike(customers.comparisonName, pattern), ilike(customers.taxId, pattern)];
    // "42" and "0042" both find customer code 42.
    if (/^\d{1,9}$/.test(text)) matches.push(eq(customers.code, Number(text)));
    conditions.push(or(...matches));
  }
  return and(...conditions);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
