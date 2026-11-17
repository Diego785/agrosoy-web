import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { users } from "@/modules/identity/infrastructure/auth.tables";
import { DomainError } from "@/shared/domain/domain-error";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import { comparableText } from "@/shared/infrastructure/db/comparable-text";
import { violatedUniqueConstraint } from "@/shared/infrastructure/db/postgres-errors";
import type { CustomerQuery, CustomerRepository } from "../application/ports";
import type { CustomerRecord } from "../domain/customer";
import {
  CUSTOMER_ALIAS_KEY,
  CUSTOMER_NAME_KEY,
  authorizedReceivers,
  customerAliases,
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
        identityCard: row.identityCard,
        phone: row.phone,
        zoneId: row.zoneId,
        locality: row.locality,
        technicianId: row.technicianId,
        usualPaymentTerms: row.usualPaymentTerms,
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
      const [properties, receivers, assignments, aliases] = await Promise.all([
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
        executor
          .select({ id: customerAliases.id, name: customerAliases.name })
          .from(customerAliases)
          .where(eq(customerAliases.customerId, id))
          .orderBy(asc(customerAliases.comparisonName)),
      ]);
      const { customer } = row;
      return {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        taxId: customer.taxId,
        identityCard: customer.identityCard,
        phone: customer.phone,
        zoneId: customer.zoneId,
        locality: customer.locality,
        technicianId: customer.technicianId,
        usualPaymentTerms: customer.usualPaymentTerms,
        exchangeRateKind: customer.exchangeRateKind,
        fixedExchangeRate: customer.fixedExchangeRate,
        notes: customer.notes,
        zoneName: row.zoneName,
        technicianName: row.technicianName,
        isActive: customer.isActive,
        properties,
        receivers,
        assignments,
        aliases,
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

    async activeOptions() {
      return executor
        .select({
          id: customers.id,
          code: customers.code,
          name: customers.name,
          fixedExchangeRate: customers.fixedExchangeRate,
          usualPaymentTerms: customers.usualPaymentTerms,
        })
        .from(customers)
        .where(eq(customers.isActive, true))
        .orderBy(asc(customers.comparisonName));
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
            identityCard: customers.identityCard,
            phone: customers.phone,
            zoneName: zones.name,
            locality: customers.locality,
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

    portfolioList() {
      return executor
        .select({
          id: customers.id,
          code: customers.code,
          name: customers.name,
          locality: customers.locality,
          technicianId: customers.technicianId,
          technicianName: users.name,
        })
        .from(customers)
        .leftJoin(users, eq(users.id, customers.technicianId))
        .where(eq(customers.isActive, true))
        .orderBy(asc(customers.comparisonName));
    },

    async technicianOf(customerIds) {
      if (customerIds.length === 0) return new Map();
      const rows = await executor
        .select({ id: customers.id, technicianId: customers.technicianId })
        .from(customers)
        .where(inArray(customers.id, [...customerIds]));
      return new Map(rows.map((row) => [row.id, row.technicianId]));
    },

    async setTechnician(customerId, technicianId) {
      await executor
        .update(customers)
        .set({ technicianId, updatedAt: new Date() })
        .where(eq(customers.id, customerId));
    },

    async localities() {
      const rows = await executor
        .selectDistinct({ locality: customers.locality })
        .from(customers)
        .where(isNotNull(customers.locality))
        .orderBy(asc(customers.locality));
      return rows.flatMap((row) => row.locality ?? []);
    },

    async nameTaken(comparisonName) {
      const [row] = await executor
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.comparisonName, comparisonName));
      return row !== undefined;
    },

    async addAlias(customerId, alias, actorId) {
      try {
        const [row] = await executor
          .insert(customerAliases)
          .values({ customerId, ...alias, createdBy: actorId })
          .returning({ id: customerAliases.id });
        if (!row) throw new Error("Insert returned no alias");
        return row;
      } catch (error) {
        if (violatedUniqueConstraint(error) === CUSTOMER_ALIAS_KEY) {
          throw new DomainError("DUPLICATE", { field: "name" });
        }
        throw error;
      }
    },

    async removeAlias(customerId, aliasId) {
      const rows = await executor
        .delete(customerAliases)
        .where(and(eq(customerAliases.id, aliasId), eq(customerAliases.customerId, customerId)))
        .returning({ name: customerAliases.name });
      if (!rows[0]) throw new DomainError("NOT_FOUND", { entity: "alias", id: aliasId });
      return rows[0];
    },
  };
}

function toRow(customer: CustomerRecord) {
  const { exchangeRateAgreement, ...rest } = customer;
  return {
    ...rest,
    // Explicit nulls so an update clears fields that were emptied in the form.
    taxId: rest.taxId ?? null,
    identityCard: rest.identityCard ?? null,
    phone: rest.phone ?? null,
    zoneId: rest.zoneId ?? null,
    locality: rest.locality ?? null,
    technicianId: rest.technicianId ?? null,
    usualPaymentTerms: rest.usualPaymentTerms ?? null,
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
    const matches: SQL[] = [
      ilike(customers.comparisonName, pattern),
      ilike(customers.taxId, pattern),
      ilike(customers.identityCard, pattern),
      ilike(comparableText(customers.locality), pattern),
    ];
    // "42" and "0042" both find customer code 42.
    if (/^\d{1,9}$/.test(text)) matches.push(eq(customers.code, Number(text)));
    conditions.push(or(...matches));
  }
  return and(...conditions);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
