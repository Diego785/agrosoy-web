"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { withTransaction } from "@/shared/infrastructure/db/client";
import type { ActionResult } from "@/shared/presentation/action-result";
import { runAction } from "@/shared/presentation/run-action";
import { convertCustomers, convertProducts } from "../application/conversion";
import { convertSales, correctSheetEntry, undoSalesConversion } from "../application/sales-conversion";
import type { CorrectSheetEntryInput } from "../application/sheet-entry-schemas";
import { conversionDeps, salesConversionDeps } from "../infrastructure/conversion-adapters";

export async function convertCustomersAction(
  batchId: string,
  technicianId: string,
  links: { key: string; customerId: string }[],
): Promise<ActionResult<{ created: number; linked: number }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const result = await withTransaction((tx) =>
      convertCustomers(conversionDeps(tx, actor), actor, { batchId, technicianId, links }),
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
  technicianId: string;
}): Promise<ActionResult<{ notes: number; entries: number }>> {
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

export async function correctSheetEntryAction(input: CorrectSheetEntryInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => correctSheetEntry(salesConversionDeps(tx, actor), actor, input));
    revalidatePath("/", "layout");
    return null;
  });
}
