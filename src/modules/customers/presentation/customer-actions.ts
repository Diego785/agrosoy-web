"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { withTransaction } from "@/shared/infrastructure/db/client";
import type { ActionResult } from "@/shared/presentation/action-result";
import { runAction } from "@/shared/presentation/run-action";
import type { CustomerInput, ZoneInput } from "../application/customer-schemas";
import { createZone, registerCustomer, updateCustomer } from "../application/customer-use-cases";
import { customerDeps } from "./customer-deps";
import { CUSTOMERS_PATH, ZONES_PATH } from "./customer-routes";

export async function registerCustomerAction(
  input: CustomerInput,
): Promise<ActionResult<{ id: string; code: number }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const created = await withTransaction((tx) => registerCustomer(customerDeps(tx), actor, input));
    revalidatePath(CUSTOMERS_PATH);
    return created;
  });
}

export async function updateCustomerAction(
  customerId: string,
  input: CustomerInput,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => updateCustomer(customerDeps(tx), actor, customerId, input));
    revalidatePath(CUSTOMERS_PATH, "layout");
    return null;
  });
}

export async function createZoneAction(input: ZoneInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const created = await withTransaction((tx) => createZone(customerDeps(tx), actor, input));
    revalidatePath(ZONES_PATH);
    return created;
  });
}
