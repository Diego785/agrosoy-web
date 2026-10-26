import { z } from "zod";
import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { campaignOn, campaignRecord, overlaps, type CampaignRecord } from "../domain/campaign";
import type { Campaign, CampaignRepository } from "./campaign-ports";
import { campaignSchema } from "./campaign-schemas";

export type CampaignDeps = { campaigns: CampaignRepository; audit: AuditTrail };

export async function createCampaign(
  deps: CampaignDeps,
  actor: Actor,
  input: unknown,
): Promise<{ id: string }> {
  assertCan(actor, "catalog.manage");
  const record = await validCampaign(deps.campaigns, input);
  const created = await deps.campaigns.insert(record);
  await deps.audit.record({
    actorId: actor.id,
    action: "campaigns.create",
    entityType: "campaign",
    entityId: created.id,
    payload: record,
  });
  return created;
}

export async function updateCampaign(
  deps: CampaignDeps,
  actor: Actor,
  campaignId: unknown,
  input: unknown,
): Promise<void> {
  assertCan(actor, "catalog.manage");
  const existing = await findCampaign(deps.campaigns, campaignId);
  if (existing.status === "closed") throw new DomainError("FORBIDDEN", { reason: "campaign_closed" });
  const record = await validCampaign(deps.campaigns, input, existing.id);
  await deps.campaigns.update(existing.id, record);
  await deps.audit.record({
    actorId: actor.id,
    action: "campaigns.update",
    entityType: "campaign",
    entityId: existing.id,
    payload: record,
  });
}

export async function listCampaigns(
  deps: Pick<CampaignDeps, "campaigns">,
  actor: Actor,
): Promise<Campaign[]> {
  assertCan(actor, "catalog.view");
  return deps.campaigns.list();
}

export async function getCampaign(
  deps: Pick<CampaignDeps, "campaigns">,
  actor: Actor,
  campaignId: unknown,
): Promise<Campaign> {
  assertCan(actor, "catalog.view");
  return findCampaign(deps.campaigns, campaignId);
}

/** The campaign a Bolivian ISO date falls in, if any. */
export async function campaignOnDate(
  deps: Pick<CampaignDeps, "campaigns">,
  actor: Actor,
  isoDate: string,
): Promise<Campaign | undefined> {
  assertCan(actor, "catalog.view");
  return campaignOn(await deps.campaigns.list(), isoDate);
}

async function validCampaign(
  campaigns: CampaignRepository,
  input: unknown,
  exceptId?: string,
): Promise<CampaignRecord> {
  const record = campaignRecord(validateInput(campaignSchema, input));
  const clash = (await campaigns.list()).find(
    (campaign) => campaign.id !== exceptId && overlaps(campaign, record),
  );
  if (clash) {
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: { startsOn: ["Las fechas se cruzan con otra campaña."] },
    });
  }
  return record;
}

async function findCampaign(campaigns: CampaignRepository, campaignId: unknown): Promise<Campaign> {
  const id = validateInput(z.uuid(), campaignId);
  const campaign = await campaigns.findById(id);
  if (!campaign) throw new DomainError("NOT_FOUND", { entity: "campaign", id });
  return campaign;
}
