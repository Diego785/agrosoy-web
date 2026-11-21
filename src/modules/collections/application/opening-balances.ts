import { z } from "zod";
import type { LedgerRepository } from "@/modules/receivables/application/ledger-ports";
import { postToLedger, reverseInLedger } from "@/modules/receivables/application/ledger-service";
import { posting } from "@/modules/receivables/domain/ledger";
import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import { type Paged, pageWindow, paged } from "@/shared/application/pagination";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { Money } from "@/shared/domain/money";
import { normalizeForComparison, optionalText } from "@/shared/domain/text";
import type { CollectionLookups, OpeningBalanceRepository, OpeningBalanceView } from "./collection-ports";
import { openingBalanceSchema, openingBalanceSearchSchema, voidReasonSchema } from "./collection-schemas";

export type OpeningBalanceDeps = {
  openingBalances: OpeningBalanceRepository;
  ledger: LedgerRepository;
  lookups: Pick<CollectionLookups, "customer" | "campaignStatus">;
  audit: AuditTrail;
  today: () => string;
};

/**
 * Debt a customer carries in at go-live in one campaign, without the notes and payments behind it
 * (D29). One in force per customer and campaign; to change it, void it and enter it again. A closed
 * campaign takes one too, since old debt is exactly what this is for.
 */
export async function recordOpeningBalance(
  deps: Omit<OpeningBalanceDeps, "today">,
  actor: Actor,
  input: unknown,
): Promise<{ id: string }> {
  assertCan(actor, "payments.manage");
  const data = validateInput(openingBalanceSchema, input);
  const fieldErrors: Record<string, string[]> = {};
  if (!(await deps.lookups.customer(data.customerId))?.isActive) {
    fieldErrors.customerId = ["Elige un cliente activo."];
  }
  if (!(await deps.lookups.campaignStatus(data.campaignId))) fieldErrors.campaignId = ["Elige una campaña."];
  if (Object.keys(fieldErrors).length > 0) throw new DomainError("VALIDATION_FAILED", { fieldErrors });
  if (await deps.openingBalances.hasRecorded(data.customerId, data.campaignId)) {
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: {
        campaignId: ["Ya tiene un saldo inicial en esa campaña; anúlalo para registrar otro."],
      },
    });
  }
  const amount = Money.parse(data.amount);
  if (!amount.isPositive()) {
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: { amount: ["Escribe un monto mayor que 0."] },
    });
  }
  const signed = data.direction === "in_favor" ? amount.negate() : amount;
  const record = {
    balanceDate: data.balanceDate,
    customerId: data.customerId,
    campaignId: data.campaignId,
    amount: signed,
    note: optionalText(data.note) ?? null,
  };
  const created = await deps.openingBalances.insert(record, actor.id);
  await postToLedger(
    deps.ledger,
    [
      posting({
        customerId: record.customerId,
        campaignId: record.campaignId,
        date: record.balanceDate,
        kind: "opening_balance",
        amount: signed,
        source: { type: "opening_balance", id: created.id },
      }),
    ],
    actor.id,
  );
  await deps.audit.record({
    actorId: actor.id,
    action: "collections.record_opening_balance",
    entityType: "customer",
    entityId: record.customerId,
    payload: {
      openingBalanceId: created.id,
      campaignId: record.campaignId,
      usdAmount: signed.toDecimalString(),
    },
  });
  return created;
}

/** Cancels an opening balance entered by mistake; its entry is reversed the day of the void (D6). */
export async function voidOpeningBalance(
  deps: Pick<OpeningBalanceDeps, "openingBalances" | "ledger" | "audit" | "today">,
  actor: Actor,
  openingBalanceId: unknown,
  input: unknown,
): Promise<void> {
  assertCan(actor, "payments.manage");
  const id = validateInput(z.uuid(), openingBalanceId);
  const { reason } = validateInput(voidReasonSchema, input);
  const balance = await deps.openingBalances.findById(id);
  if (!balance) throw new DomainError("NOT_FOUND", { entity: "opening_balance", id });
  if (balance.status !== "recorded") throw new DomainError("INVALID_STATE", { status: balance.status });
  await deps.openingBalances.markVoided(id, reason, actor.id);
  await reverseInLedger(deps.ledger, { type: "opening_balance", id }, deps.today(), actor.id);
  await deps.audit.record({
    actorId: actor.id,
    action: "collections.void_opening_balance",
    entityType: "customer",
    entityId: balance.customer.id,
    payload: { openingBalanceId: id, reason },
  });
}

export async function listOpeningBalances(
  deps: Pick<OpeningBalanceDeps, "openingBalances">,
  actor: Actor,
  input: unknown,
): Promise<Paged<OpeningBalanceView>> {
  assertCan(actor, "payments.manage");
  const { text, status, page, pages } = validateInput(openingBalanceSearchSchema, input);
  const result = await deps.openingBalances.list({
    text: normalizeForComparison(text),
    status,
    ...pageWindow({ page, pages }),
  });
  return paged({ page, pages }, result);
}
