import type { LedgerRepository } from "@/modules/receivables/application/ledger-ports";
import { postToLedger, reverseInLedger } from "@/modules/receivables/application/ledger-service";
import { posting } from "@/modules/receivables/domain/ledger";
import type { DocumentCounter } from "@/shared/application/document-counter";
import type { Allocation } from "../domain/allocation";
import type { PaymentRecord } from "../domain/payment";
import type { PaymentRepository } from "./collection-ports";

// Writing payments, shared by the collections use cases and by confirming cash notes (sales).
// Callers check permissions and run it inside their transaction.

export type PaymentWriteDeps = {
  payments: PaymentRepository;
  receipts: DocumentCounter;
  ledger: LedgerRepository;
};

/** Saves the payment with the next receipt number and credits each allocation in its campaign. */
export async function savePayment(
  deps: PaymentWriteDeps,
  payment: PaymentRecord,
  allocations: readonly Allocation[],
  actorId: string,
): Promise<{ id: string; receiptNumber: number }> {
  const receiptNumber = await deps.receipts.take((candidate) => deps.payments.receiptNumberInUse(candidate));
  const { id } = await deps.payments.insert(payment, allocations, receiptNumber, actorId);
  await postToLedger(
    deps.ledger,
    allocations.map((allocation) =>
      posting({
        customerId: payment.customerId,
        campaignId: allocation.campaignId,
        date: payment.paymentDate,
        kind: "payment",
        amount: allocation.amount,
        source: { type: "payment", id },
      }),
    ),
    actorId,
  );
  return { id, receiptNumber };
}

/** Marks the payment voided and gives its credits back to the debt, dated the day of the void. */
export async function cancelPayment(
  deps: Pick<PaymentWriteDeps, "payments" | "ledger">,
  paymentId: string,
  reason: string,
  date: string,
  actorId: string,
): Promise<void> {
  await deps.payments.markVoided(paymentId, reason, actorId);
  await reverseInLedger(deps.ledger, { type: "payment", id: paymentId }, date, actorId);
}
