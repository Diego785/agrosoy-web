"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { withTransaction } from "@/shared/infrastructure/db/client";
import type { ActionResult } from "@/shared/presentation/action-result";
import { runAction } from "@/shared/presentation/run-action";
import type {
  NewProductInput,
  PresentationInput,
  ProductInput,
  SavePricesInput,
} from "../application/catalog-schemas";
import {
  addPresentation,
  createProduct,
  savePrices,
  setPresentationActive,
  setProductActive,
  updateProduct,
} from "../application/catalog-use-cases";
import { catalogDeps } from "./catalog-deps";
import { PRICES_PATH, PRODUCTS_PATH } from "./catalog-routes";

export async function createProductAction(
  input: NewProductInput,
): Promise<ActionResult<{ id: string; codes: string[] }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const created = await withTransaction((tx) => createProduct(catalogDeps(tx), actor, input));
    revalidatePath(PRODUCTS_PATH, "layout");
    return created;
  });
}

export async function updateProductAction(
  productId: string,
  input: ProductInput,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => updateProduct(catalogDeps(tx), actor, productId, input));
    revalidatePath(PRODUCTS_PATH, "layout");
    return null;
  });
}

export async function addPresentationAction(
  productId: string,
  input: PresentationInput,
): Promise<ActionResult<{ id: string; code: string }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const created = await withTransaction((tx) => addPresentation(catalogDeps(tx), actor, productId, input));
    revalidatePath(PRODUCTS_PATH, "layout");
    return created;
  });
}

export async function setProductActiveAction(
  productId: string,
  isActive: boolean,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => setProductActive(catalogDeps(tx), actor, productId, isActive));
    revalidatePath(PRODUCTS_PATH, "layout");
    return null;
  });
}

export async function setPresentationActiveAction(
  productId: string,
  presentationId: string,
  isActive: boolean,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) =>
      setPresentationActive(catalogDeps(tx), actor, productId, presentationId, isActive),
    );
    revalidatePath(PRODUCTS_PATH, "layout");
    return null;
  });
}

export async function savePricesAction(input: SavePricesInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => savePrices(catalogDeps(tx), actor, input));
    revalidatePath(PRICES_PATH);
    return null;
  });
}
