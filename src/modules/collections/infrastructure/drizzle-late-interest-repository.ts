import { and, eq, inArray, sql } from "drizzle-orm";
import { campaigns, dueDateExtensions } from "@/modules/campaigns/infrastructure/campaigns.table";
import { customers } from "@/modules/customers/infrastructure/customers.tables";
import { ledgerEntries } from "@/modules/receivables/infrastructure/ledger.tables";
import { DomainError } from "@/shared/domain/domain-error";
import { Money } from "@/shared/domain/money";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import { violatedUniqueConstraint } from "@/shared/infrastructure/db/postgres-errors";
import type { LateInterestRepository } from "../application/collection-ports";
import { proposalKey } from "../domain/interest";
import { charges, LATE_INTEREST_KEY, lateInterestDecisions } from "./collections.tables";

/** Reads the ledger, campaigns and extensions late-payment interest works from (D38). */
export function drizzleLateInterestRepository(executor: DbExecutor): LateInterestRepository {
  return {
    async entries() {
      const rows = await executor
        .select({
          id: ledgerEntries.id,
          customerId: ledgerEntries.customerId,
          campaignId: ledgerEntries.campaignId,
          date: ledgerEntries.entryDate,
          amount: ledgerEntries.amount,
          reversesEntryId: ledgerEntries.reversesEntryId,
          isInterest: sql<boolean>`coalesce(${charges.concept} = 'interest', false)`,
        })
        .from(ledgerEntries)
        .leftJoin(
          charges,
          and(eq(ledgerEntries.sourceType, "charge"), eq(charges.id, ledgerEntries.sourceId)),
        );
      return rows.map((row) => ({ ...row, amount: Money.parse(row.amount) }));
    },

    campaigns() {
      return executor
        .select({ id: campaigns.id, season: campaigns.season, year: campaigns.year, dueOn: campaigns.dueOn })
        .from(campaigns);
    },

    extensions() {
      return executor
        .select({
          customerId: dueDateExtensions.customerId,
          campaignId: dueDateExtensions.campaignId,
          dueOn: dueDateExtensions.dueOn,
        })
        .from(dueDateExtensions);
    },

    async decidedKeys() {
      const rows = await executor
        .select({
          customerId: lateInterestDecisions.customerId,
          campaignId: lateInterestDecisions.campaignId,
          dueCampaignId: lateInterestDecisions.dueCampaignId,
        })
        .from(lateInterestDecisions);
      return new Set(rows.map(proposalKey));
    },

    async customers(ids) {
      if (ids.length === 0) return [];
      return executor
        .select({ id: customers.id, code: customers.code, name: customers.name })
        .from(customers)
        .where(inArray(customers.id, [...ids]));
    },

    async record(decisions, actorId) {
      if (decisions.length === 0) return;
      await executor
        .insert(lateInterestDecisions)
        .values(
          decisions.map((decision) => ({
            customerId: decision.customerId,
            campaignId: decision.campaignId,
            dueCampaignId: decision.dueCampaignId,
            interestDate: decision.interestDate,
            baseUsd: decision.base.toDecimalString(),
            ratePercent: decision.ratePercent,
            outcome: decision.outcome,
            chargeId: decision.chargeId,
            decidedBy: actorId,
          })),
        )
        .catch((error: unknown) => {
          if (violatedUniqueConstraint(error) === LATE_INTEREST_KEY) {
            throw new DomainError("DUPLICATE", { field: "proposals" });
          }
          throw error;
        });
    },
  };
}
