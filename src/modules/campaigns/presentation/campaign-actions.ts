"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { withTransaction, type DbExecutor } from "@/shared/infrastructure/db/client";
import type { ActionResult } from "@/shared/presentation/action-result";
import { runAction } from "@/shared/presentation/run-action";
import type { CampaignInput } from "../application/campaign-schemas";
import { createCampaign, updateCampaign, type CampaignDeps } from "../application/campaign-use-cases";
import { drizzleCampaignRepository } from "../infrastructure/drizzle-campaign-repository";
import { CAMPAIGNS_PATH } from "./campaign-routes";

function deps(executor: DbExecutor): CampaignDeps {
  return { campaigns: drizzleCampaignRepository(executor), audit: drizzleAuditTrail(executor) };
}

export async function createCampaignAction(input: CampaignInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await requireActor();
    const created = await withTransaction((tx) => createCampaign(deps(tx), actor, input));
    revalidatePath(CAMPAIGNS_PATH);
    return created;
  });
}

export async function updateCampaignAction(
  campaignId: string,
  input: CampaignInput,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => updateCampaign(deps(tx), actor, campaignId, input));
    revalidatePath(CAMPAIGNS_PATH);
    return null;
  });
}
