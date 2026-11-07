import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { campaigns } from "@/modules/campaigns/infrastructure/campaigns.table";
import { customers } from "@/modules/customers/infrastructure/customers.tables";
import { users } from "@/modules/identity/infrastructure/auth.tables";
import { deliveryNotes } from "@/modules/sales/infrastructure/notes.tables";
import { DomainError } from "@/shared/domain/domain-error";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import type {
  ChargeRepository,
  DailyRateRepository,
  PaymentRepository,
} from "../application/collection-ports";
import { charges, dailyExchangeRates, paymentAllocations, payments } from "./collections.tables";

const recorder = alias(users, "recorder");
const voider = alias(users, "voider");
const settledNote = alias(deliveryNotes, "settled_note");

const customerRef = { id: customers.id, code: customers.code, name: customers.name };
const campaignRef = { id: campaigns.id, season: campaigns.season, year: campaigns.year };

function voidInfo(row: { voidedAt: Date | null; voidReason: string | null }, byName: string | null) {
  return row.voidedAt && row.voidReason ? { at: row.voidedAt, byName, reason: row.voidReason } : null;
}

export function drizzlePaymentRepository(executor: DbExecutor): PaymentRepository {
  return {
    async insert(payment, allocations, receiptNumber, createdBy, balance) {
      const [row] = await executor
        .insert(payments)
        .values({
          receiptNumber,
          paymentDate: payment.paymentDate,
          customerId: payment.customerId,
          currency: payment.amount.currency,
          amount: payment.amount.toDecimalString(),
          exchangeRate: payment.exchangeRate.toDecimalString(),
          usdAmount: payment.usdAmount.toDecimalString(),
          method: payment.method,
          inKindDescription: payment.inKindDescription,
          reference: payment.reference,
          observations: payment.observations,
          concept: payment.concept,
          balanceBefore: balance.before.toDecimalString(),
          balanceAfter: balance.after.toDecimalString(),
          settlesNoteId: payment.settlesNoteId,
          createdBy,
        })
        .returning({ id: payments.id });
      if (!row) throw new Error("Insert returned no payment");
      await executor.insert(paymentAllocations).values(
        allocations.map((allocation) => ({
          paymentId: row.id,
          campaignId: allocation.campaignId,
          noteId: allocation.noteId,
          usdAmount: allocation.amount.toDecimalString(),
        })),
      );
      return row;
    },

    async findById(id) {
      const [row] = await executor
        .select({
          payment: payments,
          customer: { ...customerRef, taxId: customers.taxId },
          settledNoteNumber: settledNote.number,
          recorderName: recorder.name,
          recorderDocumentId: recorder.documentId,
          voiderName: voider.name,
        })
        .from(payments)
        .innerJoin(customers, eq(customers.id, payments.customerId))
        .leftJoin(settledNote, eq(settledNote.id, payments.settlesNoteId))
        .leftJoin(recorder, sql`${recorder.id}::text = ${payments.createdBy}`)
        .leftJoin(voider, sql`${voider.id}::text = ${payments.voidedBy}`)
        .where(eq(payments.id, id));
      if (!row) return undefined;

      const allocations = await executor
        .select({
          campaign: campaignRef,
          noteId: paymentAllocations.noteId,
          noteNumber: deliveryNotes.number,
          usdAmount: paymentAllocations.usdAmount,
        })
        .from(paymentAllocations)
        .innerJoin(campaigns, eq(campaigns.id, paymentAllocations.campaignId))
        .leftJoin(deliveryNotes, eq(deliveryNotes.id, paymentAllocations.noteId))
        .where(eq(paymentAllocations.paymentId, id))
        .orderBy(asc(campaigns.startsOn));

      const { payment } = row;
      return {
        id: payment.id,
        receiptNumber: payment.receiptNumber,
        status: payment.status,
        paymentDate: payment.paymentDate,
        customer: row.customer,
        currency: payment.currency,
        amount: payment.amount,
        exchangeRate: payment.exchangeRate,
        usdAmount: payment.usdAmount,
        method: payment.method,
        inKindDescription: payment.inKindDescription,
        reference: payment.reference,
        observations: payment.observations,
        concept: payment.concept,
        balance:
          payment.balanceBefore && payment.balanceAfter
            ? { before: payment.balanceBefore, after: payment.balanceAfter }
            : null,
        settlesNote: payment.settlesNoteId
          ? { id: payment.settlesNoteId, number: row.settledNoteNumber }
          : null,
        allocations: allocations.map((allocation) => ({
          campaign: allocation.campaign,
          note: allocation.noteId ? { id: allocation.noteId, number: allocation.noteNumber } : null,
          usdAmount: allocation.usdAmount,
        })),
        recorded: {
          at: payment.createdAt,
          byName: row.recorderName,
          documentId: row.recorderDocumentId,
        },
        voided: voidInfo(payment, row.voiderName),
      };
    },

    async list({ text, status, customerId, limit, offset }) {
      const matches: (SQL | undefined)[] = [];
      if (text) {
        matches.push(ilike(customers.comparisonName, `%${escapeLike(text)}%`));
        // A number can also be the receipt's.
        if (/^\d{1,9}$/.test(text)) matches.push(eq(payments.receiptNumber, Number(text)));
      }
      const where = and(
        matches.length > 0 ? or(...matches) : undefined,
        status ? eq(payments.status, status) : undefined,
        customerId ? eq(payments.customerId, customerId) : undefined,
      );
      const [items, counted] = await Promise.all([
        executor
          .select({
            id: payments.id,
            receiptNumber: payments.receiptNumber,
            status: payments.status,
            paymentDate: payments.paymentDate,
            currency: payments.currency,
            amount: payments.amount,
            usdAmount: payments.usdAmount,
            method: payments.method,
            customerName: customers.name,
          })
          .from(payments)
          .innerJoin(customers, eq(customers.id, payments.customerId))
          .where(where)
          .orderBy(desc(payments.paymentDate), desc(payments.receiptNumber))
          .limit(limit)
          .offset(offset),
        executor
          .select({ total: count() })
          .from(payments)
          .innerJoin(customers, eq(customers.id, payments.customerId))
          .where(where),
      ]);
      return { items, total: counted[0]?.total ?? 0 };
    },

    async receiptNumberInUse(number) {
      const [row] = await executor
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.receiptNumber, number));
      return row !== undefined;
    },

    async markVoided(id, reason, actorId) {
      const updated = await executor
        .update(payments)
        .set({ status: "voided", voidReason: reason, voidedAt: new Date(), voidedBy: actorId })
        .where(and(eq(payments.id, id), eq(payments.status, "recorded")))
        .returning({ id: payments.id });
      if (updated.length === 0) throw new DomainError("INVALID_STATE", { entity: "payment", id });
    },

    async settling(noteId) {
      const rows = await executor
        .select({ id: payments.id })
        .from(payments)
        .where(and(eq(payments.settlesNoteId, noteId), eq(payments.status, "recorded")));
      return rows.map((row) => row.id);
    },
  };
}

export function drizzleChargeRepository(executor: DbExecutor): ChargeRepository {
  const select = () =>
    executor
      .select({ charge: charges, customer: customerRef, campaign: campaignRef, voiderName: voider.name })
      .from(charges)
      .innerJoin(customers, eq(customers.id, charges.customerId))
      .innerJoin(campaigns, eq(campaigns.id, charges.campaignId))
      .leftJoin(voider, sql`${voider.id}::text = ${charges.voidedBy}`);
  type Row = Awaited<ReturnType<typeof select>>[number];
  const view = (row: Row) => ({
    id: row.charge.id,
    status: row.charge.status,
    chargeDate: row.charge.chargeDate,
    customer: row.customer,
    campaign: row.campaign,
    usdAmount: row.charge.usdAmount,
    concept: row.charge.concept,
    direction: row.charge.direction,
    reason: row.charge.reason,
    voided: voidInfo(row.charge, row.voiderName),
  });

  return {
    async insert(charge, createdBy) {
      const [row] = await executor
        .insert(charges)
        .values({
          chargeDate: charge.chargeDate,
          customerId: charge.customerId,
          campaignId: charge.campaignId,
          concept: charge.concept,
          direction: charge.direction,
          usdAmount: charge.amount.toDecimalString(),
          reason: charge.reason,
          createdBy,
        })
        .returning({ id: charges.id });
      if (!row) throw new Error("Insert returned no charge");
      return row;
    },

    async findById(id) {
      const [row] = await select().where(eq(charges.id, id));
      return row ? view(row) : undefined;
    },

    async list({ text, status, limit, offset }) {
      const where = and(
        text ? ilike(customers.comparisonName, `%${escapeLike(text)}%`) : undefined,
        status ? eq(charges.status, status) : undefined,
      );
      const [rows, counted] = await Promise.all([
        select()
          .where(where)
          .orderBy(desc(charges.chargeDate), desc(charges.createdAt))
          .limit(limit)
          .offset(offset),
        executor
          .select({ total: count() })
          .from(charges)
          .innerJoin(customers, eq(customers.id, charges.customerId))
          .where(where),
      ]);
      return { items: rows.map(view), total: counted[0]?.total ?? 0 };
    },

    async markVoided(id, reason, actorId) {
      const updated = await executor
        .update(charges)
        .set({ status: "voided", voidReason: reason, voidedAt: new Date(), voidedBy: actorId })
        .where(and(eq(charges.id, id), eq(charges.status, "recorded")))
        .returning({ id: charges.id });
      if (updated.length === 0) throw new DomainError("INVALID_STATE", { entity: "charge", id });
    },
  };
}

export function drizzleDailyRateRepository(executor: DbExecutor): DailyRateRepository {
  return {
    async rateOn(isoDate) {
      const [row] = await executor
        .select({ rate: dailyExchangeRates.rate })
        .from(dailyExchangeRates)
        .where(eq(dailyExchangeRates.rateDate, isoDate));
      return row?.rate;
    },

    async save(isoDate, rate, actorId) {
      const values = { rate: rate.toDecimalString(), recordedBy: actorId, recordedAt: new Date() };
      await executor
        .insert(dailyExchangeRates)
        .values({ rateDate: isoDate, ...values })
        .onConflictDoUpdate({ target: dailyExchangeRates.rateDate, set: values });
    },
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
