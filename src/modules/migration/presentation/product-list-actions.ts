"use server";

import { revalidatePath } from "next/cache";
import { PRICES_PATH, PRODUCTS_PATH } from "@/modules/catalog/presentation/catalog-routes";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { DomainError } from "@/shared/domain/domain-error";
import { getDb, withTransaction } from "@/shared/infrastructure/db/client";
import type { ActionResult } from "@/shared/presentation/action-result";
import { runAction } from "@/shared/presentation/run-action";
import {
  importProductList,
  previewProductList,
  type ProductListPreview,
} from "../application/product-list-import";
import { productListDeps } from "../infrastructure/conversion-adapters";

async function fileFrom(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new DomainError("INVALID_FILE");
  return { fileName: file.name, content: new Uint8Array(await file.arrayBuffer()) };
}

export async function previewProductListAction(
  formData: FormData,
): Promise<ActionResult<ProductListPreview>> {
  return runAction(async () => {
    const actor = await requireActor();
    return previewProductList(productListDeps(getDb(), actor), actor, await fileFrom(formData));
  });
}

/** The file is sent again and read again, so what is saved never depends on the browser's copy. */
export async function importProductListAction(
  formData: FormData,
): Promise<ActionResult<ProductListPreview["counts"]>> {
  return runAction(async () => {
    const actor = await requireActor();
    const input = { ...(await fileFrom(formData)), campaignId: formData.get("campaignId") };
    const counts = await withTransaction((tx) => importProductList(productListDeps(tx, actor), actor, input));
    revalidatePath(PRODUCTS_PATH, "layout");
    revalidatePath(PRICES_PATH);
    return counts;
  });
}
