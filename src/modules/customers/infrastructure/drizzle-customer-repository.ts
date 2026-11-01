import { and, asc, count, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { users } from "@/modules/identity/infrastructure/auth.tables";
import { DomainError } from "@/shared/domain/domain-error";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import { violatedUniqueConstraint } from "@/shared/infrastructure/db/postgres-errors";
import type { CustomerQuery, CustomerRepository } from "../application/ports";
import type { CustomerRecord } from "../domain/customer";
import {
  CUSTOMER_NAME_KEY,
  authorizedReceivers,
  customerProperties,
  customers,
  technicianAssignments,
  zones,
} from "./customers.tables";

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

    async findDetail(id) {
      const [row] = await executor
        .select({ customer: customers, zoneName: zones.name, technicianName: users.name })
        .from(customers)
        .leftJoin(zones, eq(zones.id, customers.zoneId))
        .leftJoin(users, eq(users.id, customers.technicianId))
        .where(eq(customers.id, id));
      if (!row) return undefined;
      const [properties, receivers, assignments] = await Promise.all([
        executor
          .select({
            id: customerProperties.id,
            name: customerProperties.name,
            location: customerProperties.location,
          })
          .from(customerProperties)
          .where(and(eq(customerProperties.customerId, id), eq(customerProperties.isActive, true)))
          .orderBy(asc(customerProperties.name)),
        executor
          .select({
            id: authorizedReceivers.id,
            name: authorizedReceivers.name,
            documentId: authorizedReceivers.documentId,
            relationship: authorizedReceivers.relationship,
          })
          .from(authorizedReceivers)
          .where(and(eq(authorizedReceivers.customerId, id), eq(authorizedReceivers.isActive, true)))
          .orderBy(asc(authorizedReceivers.name)),
        executor
          .select({
            technicianName: users.name,
            startsAt: technicianAssignments.startsAt,
            endsAt: technicianAssignments.endsAt,
          })
          .from(technicianAssignments)
          .innerJoin(users, eq(users.id, technicianAssignments.technicianId))
          .where(eq(technicianAssignments.customerId, id))
          .orderBy(desc(technicianAssignments.startsAt)),
      ]);
      const { customer } = row;
      return {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        taxId: customer.taxId,
        phone: customer.phone,
        zoneId: customer.zoneId,
        technicianId: customer.technicianId,
        exchangeRateKind: customer.exchangeRateKind,
        fixedExchangeRate: customer.fixedExchangeRate,
        notes: customer.notes,
        zoneName: row.zoneName,
        technicianName: row.technicianName,
        isActive: customer.isActive,
        properties,
        receivers,
        assignments,
      };
    },

    async setActive(id, active) {
      const rows = await executor
        .update(customers)
        .set({ isActive: active })
        .where(eq(customers.id, id))
        .returning({ id: customers.id });
      if (rows.length === 0) throw new DomainError("NOT_FOUND", { entity: "customer", id });
    },

    async assignTechnician(customerId, technicianId) {
      await executor
        .update(technicianAssignments)
        .set({ endsAt: sql`now()` })
        .where(and(eq(technicianAssignments.customerId, customerId), isNull(technicianAssignments.endsAt)));
      if (technicianId) {
        await executor.insert(technicianAssignments).values({ customerId, technicianId });
      }
    },

    async addProperty(customerId, property) {
      const [row] = await executor
        .insert(customerProperties)
        .values({ customerId, name: property.name, location: property.location ?? null })
        .returning({ id: customerProperties.id });
      if (!row) throw new Error("Insert returned no property");
      return row;
    },

    async deactivateProperty(customerId, propertyId) {
      const rows = await executor
        .update(customerProperties)
        .set({ isActive: false })
        .where(
          and(
            eq(customerProperties.id, propertyId),
            eq(customerProperties.customerId, customerId),
            eq(customerProperties.isActive, true),
          ),
        )
        .returning({ id: customerProperties.id });
      if (rows.length === 0) throw new DomainError("NOT_FOUND", { entity: "property", id: propertyId });
    },

    async addReceiver(customerId, receiver) {
      const [row] = await executor
        .insert(authorizedReceivers)
        .values({
          customerId,
          name: receiver.name,
          documentId: receiver.documentId ?? null,
          relationship: receiver.relationship,
        })
        .returning({ id: authorizedReceivers.id });
      if (!row) throw new Error("Insert returned no receiver");
      return row;
    },

    async deactivateReceiver(customerId, receiverId) {
      const rows = await executor
        .update(authorizedReceivers)
        .set({ isActive: false })
        .where(
          and(
            eq(authorizedReceivers.id, receiverId),
            eq(authorizedReceivers.customerId, customerId),
            eq(authorizedReceivers.isActive, true),
          ),
        )
        .returning({ id: authorizedReceivers.id });
      if (rows.length === 0) throw new DomainError("NOT_FOUND", { entity: "receiver", id: receiverId });
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

function searchFilter({ text, zoneId, status }: CustomerQuery): SQL | undefined {
  const conditions: (SQL | undefined)[] = [eq(customers.isActive, status === "active")];
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
