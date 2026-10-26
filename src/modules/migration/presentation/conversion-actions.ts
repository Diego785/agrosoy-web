"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { withTransaction } from "@/shared/infrastructure/db/client";
import type { ActionResult } from "@/shared/presentation/action-result";
import { runAction } from "@/shared/presentation/run-action";
import { convertCustomers, convertProducts } from "../application/conversion";
import { conversionDeps } from "../infrastructure/conversion-adapters";

export async function convertCustomersAction(
  batchId: string,
  technicianId: string,
): Promise<ActionResult<{ created: number }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const result = await withTransaction((tx) =>
      convertCustomers(conversionDeps(tx, actor), actor, { batchId, technicianId }),
    );
    revalidatePath("/", "layout");
    return result;
  });
}

export async function convertProductsAction(
  batchId: string,
  decisions: { key: string; line?: string; saleUnit: string }[],
): Promise<ActionResult<{ createdProducts: number; addedPresentations: number; skipped: string[] }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const result = await withTransaction((tx) =>
      convertProducts(conversionDeps(tx, actor), actor, { batchId, decisions }),
    );
    revalidatePath("/", "layout");
    return result;
  });
}
