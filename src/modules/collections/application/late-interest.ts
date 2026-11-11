import { z } from "zod";
import type { LedgerRepository } from "@/modules/receivables/application/ledger-ports";
import { postToLedger } from "@/modules/receivables/application/ledger-service";
import { posting } from "@/modules/receivables/domain/ledger";
import type { Actor } from "@/shared/application/actor";
import type { AuditTrail } from "@/shared/application/audit-trail";
import { assertCan } from "@/shared/application/permissions";
import type { SettingsStore } from "@/shared/application/settings-store";
import { validateInput } from "@/shared/application/validate-input";
import { DomainError } from "@/shared/domain/domain-error";
import { Money } from "@/shared/domain/money";
import {
  DEFAULT_INTEREST_SETTINGS,
  interestProposals,
  interestReason,
  proposalKey,
  type InterestProposal,
  type InterestSettings,
} from "../domain/interest";
import { chargeLedgerAmount, chargeRecord } from "../domain/payment";
import type {
  ChargeRepository,
  InterestDecision,
  InterestProposalView,
  LateInterestRepository,
} from "./collection-ports";
import { interestDecisionSchema, interestSettingsSchema } from "./collection-schemas";

export type LateInterestDeps = {
  interest: LateInterestRepository;
  charges: ChargeRepository;
  ledger: LedgerRepository;
  settings: SettingsStore;
  audit: AuditTrail;
  /** Today's business date in Bolivia: a day earns interest once it has passed. */
  today: () => string;
};

const RATE = /^\d{1,2}(\.\d{1,2})?$/;

const storedSettings = z
  .object({
    ratePercent: z
      .string()
      .regex(RATE)
      .refine((value) => Number(value) > 0)
      .catch(DEFAULT_INTEREST_SETTINGS.ratePercent),
    graceDays: z.int().min(0).max(365).catch(DEFAULT_INTEREST_SETTINGS.graceDays),
    startsOn: z.iso.date().nullable().catch(DEFAULT_INTEREST_SETTINGS.startsOn),
  })
  .catch(DEFAULT_INTEREST_SETTINGS);

/** What administration saved, field by field over the defaults (3 %, no extra days, not started). */
export async function readInterestSettings(settings: SettingsStore): Promise<InterestSettings> {
  return storedSettings.parse((await settings.get("late_interest")) ?? {});
}

export async function interestSettings(
  deps: Pick<LateInterestDeps, "settings">,
  actor: Actor,
): Promise<InterestSettings> {
  assertCan(actor, "payments.manage");
  return readInterestSettings(deps.settings);
}

/** "03.50" as "3.5": the rate is stored and printed the way people write it. */
function plainRate(value: string): string {
  const [whole = "0", fraction = ""] = value.split(".");
  const decimals = fraction.replace(/0+$/, "");
  return `${Number(whole)}${decimals ? `.${decimals}` : ""}`;
}

/** The rate, the days after a due date and the first day interest may apply (D38). */
export async function updateInterestSettings(
  deps: Pick<LateInterestDeps, "settings" | "audit">,
  actor: Actor,
  input: unknown,
): Promise<void> {
  assertCan(actor, "payments.manage");
  const data = validateInput(interestSettingsSchema, input);
  const value: InterestSettings = {
    ratePercent: plainRate(data.ratePercent),
    graceDays: data.graceDays,
    startsOn: data.startsOn,
  };
  await deps.settings.set("late_interest", value, actor.id);
  await deps.audit.record({
    actorId: actor.id,
    action: "collections.set_interest",
    entityType: "setting",
    entityId: "late_interest",
    payload: {
      ...value,
      name: `${value.ratePercent.replace(".", ",")} %${
        value.graceDays === 0 ? "" : ` a los ${value.graceDays} días`
      } desde el ${data.startsOn.split("-").toReversed().join("/")}`,
    },
  });
}

async function currentProposals(deps: Pick<LateInterestDeps, "interest" | "settings" | "today">): Promise<{
  settings: InterestSettings;
  proposals: InterestProposal[];
  campaigns: Awaited<ReturnType<LateInterestRepository["campaigns"]>>;
}> {
  // One query at a time: charging runs inside a transaction, on a single connection.
  const settings = await readInterestSettings(deps.settings);
  const campaigns = await deps.interest.campaigns();
  if (!settings.startsOn) return { settings, proposals: [], campaigns };
  const entries = await deps.interest.entries();
  const extensions = await deps.interest.extensions();
  const decided = await deps.interest.decidedKeys();
  const extensionDue = new Map(
    extensions.map((extension) => [`${extension.customerId}|${extension.campaignId}`, extension.dueOn]),
  );
  const proposals = interestProposals({
    campaigns,
    entries,
    extensionOf: (customerId, campaignId) => extensionDue.get(`${customerId}|${campaignId}`),
    decided,
    settings,
    today: deps.today(),
  });
  return { settings, proposals, campaigns };
}

/**
 * The interest charges waiting for administration (D38), worked out again on every visit from the
 * ledger, so a payment typed in late is already in the base.
 */
export async function pendingInterest(
  deps: Pick<LateInterestDeps, "interest" | "settings" | "today">,
  actor: Actor,
): Promise<{
  settings: InterestSettings;
  proposals: InterestProposalView[];
  totalUsd: string;
  /** The first due date from today on, to suggest where interest starts. */
  nextDueOn: string | null;
}> {
  assertCan(actor, "payments.manage");
  const { settings, proposals, campaigns } = await currentProposals(deps);
  const customers = await deps.interest.customers([
    ...new Set(proposals.map((proposal) => proposal.customerId)),
  ]);
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const views = proposals.flatMap((proposal) => {
    const customer = customerById.get(proposal.customerId);
    const campaign = campaignById.get(proposal.campaignId);
    if (!customer || !campaign) return [];
    return [
      {
        key: proposalKey(proposal),
        customer,
        campaign: { id: campaign.id, season: campaign.season, year: campaign.year },
        interestDate: proposal.interestDate,
        baseUsd: proposal.base.toDecimalString(),
        usdAmount: proposal.amount.toDecimalString(),
      },
    ];
  });
  views.sort(
    (a, b) =>
      a.customer.name.localeCompare(b.customer.name, "es") ||
      a.interestDate.localeCompare(b.interestDate) ||
      a.campaign.year - b.campaign.year,
  );
  return {
    settings,
    proposals: views,
    totalUsd: Money.sum(proposals.map((proposal) => proposal.amount)).toDecimalString(),
    nextDueOn:
      campaigns
        .map((campaign) => campaign.dueOn)
        .filter((dueOn) => dueOn >= deps.today())
        .toSorted()[0] ?? null,
  };
}

/**
 * The chosen proposals as they stand now. Fails when one was decided meanwhile or its amount moved
 * since administration saw it (a payment typed in later, for example), so nothing is charged on a
 * figure nobody reviewed.
 */
async function chosenProposals(
  deps: Pick<LateInterestDeps, "interest" | "settings" | "today">,
  input: unknown,
): Promise<{ settings: InterestSettings; chosen: InterestProposal[] }> {
  const { proposals: requested } = validateInput(interestDecisionSchema, input);
  const { settings, proposals } = await currentProposals(deps);
  const byKey = new Map(proposals.map((proposal) => [proposalKey(proposal), proposal]));
  const chosen: InterestProposal[] = [];
  for (const { key, usdAmount } of new Map(requested.map((item) => [item.key, item])).values()) {
    const proposal = byKey.get(key);
    if (!proposal || proposal.amount.toDecimalString() !== usdAmount) {
      throw new DomainError("VALIDATION_FAILED", {
        fieldErrors: {
          proposals: [
            "La lista cambió desde que la abriste (un pago nuevo o alguien ya la revisó). Revísala de nuevo.",
          ],
        },
      });
    }
    chosen.push(proposal);
  }
  return { settings, chosen };
}

/** Each chosen proposal becomes an interest charge in the campaign owed, dated today (D24, D38). */
export async function chargeInterest(
  deps: LateInterestDeps,
  actor: Actor,
  input: unknown,
): Promise<{ charged: number }> {
  assertCan(actor, "payments.manage");
  const { settings, chosen } = await chosenProposals(deps, input);
  const decisions: InterestDecision[] = [];
  for (const proposal of chosen) {
    const charge = chargeRecord({
      chargeDate: deps.today(),
      customerId: proposal.customerId,
      campaignId: proposal.campaignId,
      concept: "interest",
      direction: "debit",
      amount: proposal.amount,
      reason: interestReason(proposal, settings.ratePercent),
    });
    const created = await deps.charges.insert(charge, actor.id);
    await postToLedger(
      deps.ledger,
      [
        posting({
          customerId: charge.customerId,
          campaignId: charge.campaignId,
          date: charge.chargeDate,
          kind: "charge",
          amount: chargeLedgerAmount(charge),
          source: { type: "charge", id: created.id },
        }),
      ],
      actor.id,
    );
    decisions.push({
      customerId: proposal.customerId,
      campaignId: proposal.campaignId,
      dueCampaignId: proposal.dueCampaignId,
      interestDate: proposal.interestDate,
      base: proposal.base,
      ratePercent: settings.ratePercent,
      outcome: "charged",
      chargeId: created.id,
    });
    await deps.audit.record({
      actorId: actor.id,
      action: "collections.charge_interest",
      entityType: "customer",
      entityId: proposal.customerId,
      payload: {
        chargeId: created.id,
        campaignId: proposal.campaignId,
        interestDate: proposal.interestDate,
        baseUsd: proposal.base.toDecimalString(),
        ratePercent: settings.ratePercent,
        usdAmount: proposal.amount.toDecimalString(),
      },
    });
  }
  await deps.interest.record(decisions, actor.id);
  return { charged: decisions.length };
}

/** Administration decides not to charge these; they are not proposed again. */
export async function waiveInterest(
  deps: Pick<LateInterestDeps, "interest" | "settings" | "audit" | "today">,
  actor: Actor,
  input: unknown,
): Promise<{ waived: number }> {
  assertCan(actor, "payments.manage");
  const { settings, chosen } = await chosenProposals(deps, input);
  await deps.interest.record(
    chosen.map((proposal) => ({
      customerId: proposal.customerId,
      campaignId: proposal.campaignId,
      dueCampaignId: proposal.dueCampaignId,
      interestDate: proposal.interestDate,
      base: proposal.base,
      ratePercent: settings.ratePercent,
      outcome: "waived" as const,
      chargeId: null,
    })),
    actor.id,
  );
  for (const proposal of chosen) {
    await deps.audit.record({
      actorId: actor.id,
      action: "collections.waive_interest",
      entityType: "customer",
      entityId: proposal.customerId,
      payload: {
        campaignId: proposal.campaignId,
        interestDate: proposal.interestDate,
        usdAmount: proposal.amount.toDecimalString(),
      },
    });
  }
  return { waived: chosen.length };
}
