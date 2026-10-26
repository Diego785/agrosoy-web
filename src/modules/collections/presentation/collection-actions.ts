"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { withTransaction } from "@/shared/infrastructure/db/client";
import type { ActionResult } from "@/shared/presentation/action-result";
import { runAction } from "@/shared/presentation/run-action";
import type {
  ChargeInput,
  DailyRateInput,
  PaymentInput,
  VoidReasonInput,
} from "../application/collection-schemas";
import {
  recordCharge,
  recordPayment,
  setDailyRate,
  voidCharge,
  voidPayment,
} from "../application/collection-use-cases";
import { collectionDeps } from "./collection-deps";
import { PAYMENTS_PATH } from "./collection-routes";

// Payments and charges change balances shown on notes, customers and statements.
const refresh = () => revalidatePath("/", "layout");

export async function recordPaymentAction(
  input: PaymentInput,
): Promise<ActionResult<{ id: string; receiptNumber: number }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const recorded = await withTransaction((tx) => recordPayment(collectionDeps(tx), actor, input));
    refresh();
    return recorded;
  });
}

export async function voidPaymentAction(
  paymentId: string,
  input: VoidReasonInput,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => voidPayment(collectionDeps(tx), actor, paymentId, input));
    refresh();
    return null;
  });
}

export async function recordChargeAction(input: ChargeInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const recorded = await withTransaction((tx) => recordCharge(collectionDeps(tx), actor, input));
    refresh();
    return recorded;
  });
}

export async function voidChargeAction(
  chargeId: string,
  input: VoidReasonInput,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => voidCharge(collectionDeps(tx), actor, chargeId, input));
    refresh();
    return null;
  });
}

export async function setDailyRateAction(input: DailyRateInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => setDailyRate(collectionDeps(tx), actor, input));
    revalidatePath(PAYMENTS_PATH);
    return null;
  });
}
