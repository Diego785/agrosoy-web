"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { withTransaction } from "@/shared/infrastructure/db/client";
import type { ActionResult } from "@/shared/presentation/action-result";
import { runAction } from "@/shared/presentation/run-action";
import { convertCustomers, convertProducts } from "../application/conversion";
import { convertSales, undoSalesConversion, type SkippedRow } from "../application/sales-conversion";
import { conversionDeps, salesConversionDeps } from "../infrastructure/conversion-adapters";

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

export async function convertSalesAction(input: {
  batchId: string;
  campaignId: string;
  cutoffDate: string;
}): Promise<ActionResult<{ notes: number; entries: number; skipped: SkippedRow[] }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const result = await withTransaction((tx) => convertSales(salesConversionDeps(tx, actor), actor, input));
    revalidatePath("/", "layout");
    return result;
  });
}

export async function undoSalesConversionAction(input: {
  batchId: string;
  reason: string;
}): Promise<ActionResult<{ voidedNotes: number }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const result = await withTransaction((tx) =>
      undoSalesConversion(salesConversionDeps(tx, actor), actor, input),
    );
    revalidatePath("/", "layout");
    return result;
  });
}
