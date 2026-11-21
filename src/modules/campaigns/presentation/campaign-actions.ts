"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { drizzleAuditTrail } from "@/shared/infrastructure/audit/drizzle-audit-trail";
import { withTransaction, type DbExecutor } from "@/shared/infrastructure/db/client";
import type { ActionResult } from "@/shared/presentation/action-result";
import { runAction } from "@/shared/presentation/run-action";
import type { CampaignInput, DueDateExtensionInput } from "../application/campaign-schemas";
import {
  createCampaign,
  setCampaignStatus,
  updateCampaign,
  type CampaignDeps,
} from "../application/campaign-use-cases";
import {
  removeDueDateExtension,
  setDueDateExtension,
  type DueDateExtensionDeps,
} from "../application/due-date-extensions";
import {
  customerExistence,
  drizzleCampaignRepository,
  drizzleDueDateExtensionRepository,
} from "../infrastructure/drizzle-campaign-repository";
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
    // The due date decides what statements show as overdue.
    revalidatePath("/", "layout");
    return null;
  });
}

export async function setCampaignStatusAction(
  campaignId: string,
  status: "open" | "closed",
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => setCampaignStatus(deps(tx), actor, campaignId, status));
    // Every form that offers a campaign, and every rule that checks one, changes with it.
    revalidatePath("/", "layout");
    return null;
  });
}

function extensionDeps(executor: DbExecutor): DueDateExtensionDeps {
  return {
    campaigns: drizzleCampaignRepository(executor),
    extensions: drizzleDueDateExtensionRepository(executor),
    customers: customerExistence(executor),
    audit: drizzleAuditTrail(executor),
  };
}

export async function setDueDateExtensionAction(input: DueDateExtensionInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => setDueDateExtension(extensionDeps(tx), actor, input));
    revalidatePath("/", "layout");
    return null;
  });
}

export async function removeDueDateExtensionAction(input: {
  customerId: string;
  campaignId: string;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    await withTransaction((tx) => removeDueDateExtension(extensionDeps(tx), actor, input));
    revalidatePath("/", "layout");
    return null;
  });
}
