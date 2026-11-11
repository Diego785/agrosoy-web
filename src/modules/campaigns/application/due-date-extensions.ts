import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import { assertCan } from "@/shared/application/permissions";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import type { CampaignRepository, DueDateExtensionRepository } from "./campaign-ports";
import { dueDateExtensionSchema, removeExtensionSchema } from "./campaign-schemas";

export type DueDateExtensionDeps = {
  campaigns: Pick<CampaignRepository, "findById">;
  extensions: DueDateExtensionRepository;
  customers: { exists(id: string): Promise<boolean> };
  audit: AuditTrail;
};

/** "2026-11-30" → "30/11/2026", for messages. */
const shown = (isoDate: string) => isoDate.split("-").toReversed().join("/");

/**
 * Gives one customer more time to pay one campaign's debt (D37): a due date later than the
 * campaign's, with its reason. Giving it again replaces it. Administration decides, as with charges.
 */
export async function setDueDateExtension(
  deps: DueDateExtensionDeps,
  actor: Actor,
  input: unknown,
): Promise<void> {
  assertCan(actor, "payments.manage");
  const data = validateInput(dueDateExtensionSchema, input);
  const campaign = await deps.campaigns.findById(data.campaignId);
  if (!campaign) throw new DomainError("NOT_FOUND", { entity: "campaign", id: data.campaignId });
  if (!(await deps.customers.exists(data.customerId))) {
    throw new DomainError("NOT_FOUND", { entity: "customer", id: data.customerId });
  }
  if (data.dueOn <= campaign.dueOn) {
    throw new DomainError("VALIDATION_FAILED", {
      fieldErrors: {
        dueOn: [`Tiene que ser después del vencimiento de la campaña (${shown(campaign.dueOn)}).`],
      },
    });
  }
  await deps.extensions.save(
    { customerId: data.customerId, campaignId: data.campaignId, dueOn: data.dueOn, reason: data.reason },
    actor.id,
  );
  await deps.audit.record({
    actorId: actor.id,
    action: "campaigns.extend_due_date",
    entityType: "customer",
    entityId: data.customerId,
    payload: { campaignId: data.campaignId, dueOn: data.dueOn, reason: data.reason },
  });
}

/** The customer's debt in the campaign falls due on the campaign's date again. */
export async function removeDueDateExtension(
  deps: Pick<DueDateExtensionDeps, "extensions" | "audit">,
  actor: Actor,
  input: unknown,
): Promise<void> {
  assertCan(actor, "payments.manage");
  const { customerId, campaignId } = validateInput(removeExtensionSchema, input);
  await deps.extensions.remove(customerId, campaignId);
  await deps.audit.record({
    actorId: actor.id,
    action: "campaigns.remove_extension",
    entityType: "customer",
    entityId: customerId,
    payload: { campaignId },
  });
}
