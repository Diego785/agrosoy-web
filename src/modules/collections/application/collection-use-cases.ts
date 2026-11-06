import { z } from "zod";
import type { LedgerRepository } from "@/modules/receivables/application/ledger-ports";
import { postToLedger, reverseInLedger } from "@/modules/receivables/application/ledger-service";
import { posting } from "@/modules/receivables/domain/ledger";
import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import type { DocumentCounter } from "@/shared/application/document-counter";
import { type Paged, pageWindow, paged } from "@/shared/application/pagination";
import { assertCan, can } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { ExchangeRate } from "@/shared/domain/exchange-rate";
import { Money } from "@/shared/domain/money";
import { normalizeForComparison, optionalText } from "@/shared/domain/text";
import { allocate, type AllocationTarget, type CampaignBalance } from "../domain/allocation";
import { chargeRecord, paymentRecord } from "../domain/payment";
import type {
  ChargeRepository,
  ChargeView,
  CollectionLookups,
  DailyRateRepository,
  PaymentListItem,
  PaymentRepository,
  PaymentView,
} from "./collection-ports";
import {
  chargeSchema,
  dailyRateSchema,
  paymentSchema,
  chargeSearchSchema,
  paymentSearchSchema,
  voidReasonSchema,
} from "./collection-schemas";
import { cancelPayment, savePayment } from "./payment-service";

export type CollectionDeps = {
  payments: PaymentRepository;
  charges: ChargeRepository;
  rates: DailyRateRepository;
  receipts: DocumentCounter;
  ledger: LedgerRepository;
  lookups: CollectionLookups;
  audit: AuditTrail;
  /** Today's business date in Bolivia; voids are dated the day they happen. */
  today: () => string;
};

/** Records a payment, applies it and credits the customer's debt (domain model, M6). */
export async function recordPayment(
  deps: Omit<CollectionDeps, "charges" | "rates" | "today">,
  actor: Actor,
  input: unknown,
): Promise<{ id: string; receiptNumber: number }> {
  assertCan(actor, "payments.manage");
  const data = validateInput(paymentSchema, input);
  const fieldErrors: Record<string, string[]> = {};
  const fail = (field: string, message: string) => (fieldErrors[field] = [message]);

  const customer = await deps.lookups.customer(data.customerId);
  if (!customer?.isActive) fail("customerId", "Elige un cliente activo.");
  const dateCampaign = await deps.lookups.campaignOn(data.paymentDate);
  if (!dateCampaign) fail("paymentDate", "La fecha no cae en ninguna campaña.");
  else if (dateCampaign.status === "closed") fail("paymentDate", "La campaña de esa fecha ya está cerrada.");

  let target: AllocationTarget = { kind: "oldest_debt" };
  if (data.target === "campaign" && data.campaignId) {
    if (!(await deps.lookups.campaignStatus(data.campaignId))) fail("campaignId", "Elige una campaña.");
    target = { kind: "campaign", campaignId: data.campaignId };
  }
  if (data.target === "note" && data.noteId) {
    const note = await deps.lookups.confirmedNote(data.noteId);
    if (note?.customerId !== data.customerId) fail("noteId", "Elige una boleta confirmada de este cliente.");
    else target = { kind: "note", noteId: data.noteId, campaignId: note.campaignId };
  }
  if (Object.keys(fieldErrors).length > 0 || !dateCampaign) {
    throw new DomainError("VALIDATION_FAILED", { fieldErrors });
  }

  const payment = paymentRecord({
    paymentDate: data.paymentDate,
    customerId: data.customerId,
    amount: Money.parse(data.amount, data.currency),
    exchangeRate: ExchangeRate.parse(data.exchangeRate),
    method: data.method,
    inKindDescription: optionalText(data.inKindDescription) ?? null,
    reference: optionalText(data.reference) ?? null,
    observations: optionalText(data.observations) ?? null,
    settlesNoteId: null,
  });
  const balances = target.kind === "oldest_debt" ? await deps.lookups.balances(data.customerId) : [];
  const allocations = allocate(payment.usdAmount, target, balances, dateCampaign.id);
  const saved = await savePayment(deps, payment, allocations, actor.id);
  await deps.audit.record({
    actorId: actor.id,
    action: "collections.record_payment",
    entityType: "payment",
    entityId: saved.id,
    payload: {
      number: saved.receiptNumber,
      customerId: data.customerId,
      usdAmount: payment.usdAmount.toDecimalString(),
    },
  });
  return saved;
}

export async function voidPayment(
  deps: Pick<CollectionDeps, "payments" | "ledger" | "audit" | "today">,
  actor: Actor,
  paymentId: unknown,
  input: unknown,
): Promise<void> {
  assertCan(actor, "payments.manage");
  const id = validateInput(z.uuid(), paymentId);
  const { reason } = validateInput(voidReasonSchema, input);
  const payment = await deps.payments.findById(id);
  if (!payment) throw new DomainError("NOT_FOUND", { entity: "payment", id });
  if (payment.status !== "recorded") throw new DomainError("INVALID_STATE", { status: payment.status });
  if (payment.settlesNote) {
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: {
        reason: [
          `Este pago llegó con la boleta al contado N.º ${payment.settlesNote.number}; anula la boleta.`,
        ],
      },
    });
  }
  await cancelPayment(deps, id, reason, deps.today(), actor.id);
  await deps.audit.record({
    actorId: actor.id,
    action: "collections.void_payment",
    entityType: "payment",
    entityId: id,
    payload: { number: payment.receiptNumber, reason },
  });
}

export async function getPayment(
  deps: Pick<CollectionDeps, "payments">,
  actor: Actor,
  paymentId: unknown,
): Promise<PaymentView> {
  assertCan(actor, "payments.manage");
  const id = validateInput(z.uuid(), paymentId);
  const payment = await deps.payments.findById(id);
  if (!payment) throw new DomainError("NOT_FOUND", { entity: "payment", id });
  return payment;
}

export async function listPayments(
  deps: Pick<CollectionDeps, "payments">,
  actor: Actor,
  input: unknown,
): Promise<Paged<PaymentListItem>> {
  assertCan(actor, "payments.manage");
  const { text, status, customerId, page, pages } = validateInput(paymentSearchSchema, input);
  const result = await deps.payments.list({
    text: normalizeForComparison(text),
    status,
    customerId: customerId || undefined,
    ...pageWindow({ page, pages }),
  });
  return paged({ page, pages }, result);
}

/** An extra debit, for example interest, in the chosen campaign. */
export async function recordCharge(
  deps: Pick<CollectionDeps, "charges" | "ledger" | "lookups" | "audit">,
  actor: Actor,
  input: unknown,
): Promise<{ id: string }> {
  assertCan(actor, "payments.manage");
  const data = validateInput(chargeSchema, input);
  const fieldErrors: Record<string, string[]> = {};
  if (!(await deps.lookups.customer(data.customerId))?.isActive) {
    fieldErrors.customerId = ["Elige un cliente activo."];
  }
  const status = await deps.lookups.campaignStatus(data.campaignId);
  if (!status) fieldErrors.campaignId = ["Elige una campaña."];
  else if (status === "closed") fieldErrors.campaignId = ["Esa campaña ya está cerrada."];
  if (Object.keys(fieldErrors).length > 0) throw new DomainError("VALIDATION_FAILED", { fieldErrors });

  const charge = chargeRecord({
    chargeDate: data.chargeDate,
    customerId: data.customerId,
    campaignId: data.campaignId,
    amount: Money.parse(data.amount),
    reason: data.reason,
  });
  const created = await deps.charges.insert(charge, actor.id);
  await postToLedger(
    deps.ledger,
    [
      posting({
        customerId: charge.customerId,
        campaignId: charge.campaignId,
        date: charge.chargeDate,
        kind: "charge",
        amount: charge.amount,
        source: { type: "charge", id: created.id },
      }),
    ],
    actor.id,
  );
  await deps.audit.record({
    actorId: actor.id,
    action: "collections.record_charge",
    entityType: "customer",
    entityId: charge.customerId,
    payload: { chargeId: created.id, usdAmount: charge.amount.toDecimalString(), reason: charge.reason },
  });
  return created;
}

export async function voidCharge(
  deps: Pick<CollectionDeps, "charges" | "ledger" | "audit" | "today">,
  actor: Actor,
  chargeId: unknown,
  input: unknown,
): Promise<void> {
  assertCan(actor, "payments.manage");
  const id = validateInput(z.uuid(), chargeId);
  const { reason } = validateInput(voidReasonSchema, input);
  const charge = await deps.charges.findById(id);
  if (!charge) throw new DomainError("NOT_FOUND", { entity: "charge", id });
  if (charge.status !== "recorded") throw new DomainError("INVALID_STATE", { status: charge.status });
  await deps.charges.markVoided(id, reason, actor.id);
  await reverseInLedger(deps.ledger, { type: "charge", id }, deps.today(), actor.id);
  await deps.audit.record({
    actorId: actor.id,
    action: "collections.void_charge",
    entityType: "customer",
    entityId: charge.customer.id,
    payload: { chargeId: id, reason },
  });
}

export async function listCharges(
  deps: Pick<CollectionDeps, "charges">,
  actor: Actor,
  input: unknown,
): Promise<Paged<ChargeView>> {
  assertCan(actor, "payments.manage");
  const { text, status, page, pages } = validateInput(chargeSearchSchema, input);
  const result = await deps.charges.list({
    text: normalizeForComparison(text),
    status,
    ...pageWindow({ page, pages }),
  });
  return paged({ page, pages }, result);
}

/** The day's rate, which notes and payments of `daily` customers use. */
export async function setDailyRate(
  deps: Pick<CollectionDeps, "rates" | "audit">,
  actor: Actor,
  input: unknown,
): Promise<void> {
  assertCan(actor, "payments.manage");
  const data = validateInput(dailyRateSchema, input);
  const rate = ExchangeRate.parse(data.rate);
  await deps.rates.save(data.rateDate, rate, actor.id);
  await deps.audit.record({
    actorId: actor.id,
    action: "collections.set_daily_rate",
    entityType: "daily_exchange_rate",
    entityId: data.rateDate,
    payload: { name: `${data.rateDate}: ${rate.toDecimalString()}` },
  });
}

/** The day's rate if administration recorded it; whoever writes notes or payments may read it. */
export async function dailyRate(
  deps: Pick<CollectionDeps, "rates">,
  actor: Actor,
  isoDate: unknown,
): Promise<string | null> {
  if (!can(actor, "notes.manage")) assertCan(actor, "payments.manage");
  return (await deps.rates.rateOn(validateInput(z.iso.date(), isoDate))) ?? null;
}

/** What the customer owes per campaign, to decide where a payment goes. */
export async function customerBalances(
  deps: Pick<CollectionDeps, "lookups">,
  actor: Actor,
  customerId: unknown,
): Promise<CampaignBalance[]> {
  assertCan(actor, "payments.manage");
  return deps.lookups.balances(validateInput(z.uuid(), customerId));
}
