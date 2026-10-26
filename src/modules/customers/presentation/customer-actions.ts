"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { withTransaction } from "@/shared/infrastructure/db/client";
import type { ActionResult } from "@/shared/presentation/action-result";
import { runAction } from "@/shared/presentation/run-action";
import type { CustomerInput, PropertyInput, ReceiverInput, ZoneInput } from "../application/customer-schemas";
import {
  addAuthorizedReceiver,
  addCustomerProperty,
  createZone,
  registerCustomer,
  removeAuthorizedReceiver,
  removeCustomerProperty,
  setCustomerActive,
  updateCustomer,
} from "../application/customer-use-cases";
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

export async function setCustomerActiveAction(
  customerId: string,
  active: boolean,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => setCustomerActive(customerDeps(tx), actor, customerId, active));
    revalidatePath(CUSTOMERS_PATH, "layout");
    return null;
  });
}

export async function addPropertyAction(
  customerId: string,
  input: PropertyInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const created = await withTransaction((tx) =>
      addCustomerProperty(customerDeps(tx), actor, customerId, input),
    );
    revalidatePath(CUSTOMERS_PATH, "layout");
    return created;
  });
}

export async function removePropertyAction(
  customerId: string,
  propertyId: string,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => removeCustomerProperty(customerDeps(tx), actor, customerId, propertyId));
    revalidatePath(CUSTOMERS_PATH, "layout");
    return null;
  });
}

export async function addReceiverAction(
  customerId: string,
  input: ReceiverInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const created = await withTransaction((tx) =>
      addAuthorizedReceiver(customerDeps(tx), actor, customerId, input),
    );
    revalidatePath(CUSTOMERS_PATH, "layout");
    return created;
  });
}

export async function removeReceiverAction(
  customerId: string,
  receiverId: string,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => removeAuthorizedReceiver(customerDeps(tx), actor, customerId, receiverId));
    revalidatePath(CUSTOMERS_PATH, "layout");
    return null;
  });
}
