import { and, eq, sql, sum } from "drizzle-orm";
import { campaignOn } from "@/modules/campaigns/domain/campaign";
import { campaigns } from "@/modules/campaigns/infrastructure/campaigns.table";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { customers } from "@/modules/customers/infrastructure/customers.tables";
import { ledgerEntries } from "@/modules/receivables/infrastructure/ledger.tables";
import { deliveryNotes } from "@/modules/sales/infrastructure/notes.tables";
import { Money } from "@/shared/domain/money";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import type { CollectionLookups } from "../application/collection-ports";

/** Reads what payments and charges refer to in the customers, campaigns, sales and receivables modules. */
export function collectionLookups(executor: DbExecutor): CollectionLookups {
  return {
    async customer(id) {
      const [row] = await executor
        .select({ isActive: customers.isActive, fixedExchangeRate: customers.fixedExchangeRate })
        .from(customers)
        .where(eq(customers.id, id));
      return row;
    },

    async campaignOn(isoDate) {
      const campaign = campaignOn(await drizzleCampaignRepository(executor).list(), isoDate);
      return campaign ? { id: campaign.id, status: campaign.status } : undefined;
    },

    async campaignStatus(id) {
      const [row] = await executor
        .select({ status: campaigns.status })
        .from(campaigns)
        .where(eq(campaigns.id, id));
      return row?.status;
    },

    async confirmedNote(id) {
      const [row] = await executor
        .select({ customerId: deliveryNotes.customerId, campaignId: deliveryNotes.campaignId })
        .from(deliveryNotes)
        .where(and(eq(deliveryNotes.id, id), eq(deliveryNotes.status, "confirmed")));
      return row;
    },

    async balances(customerId) {
      const rows = await executor
        .select({
          campaignId: ledgerEntries.campaignId,
          startsOn: campaigns.startsOn,
          balance: sql<string>`${sum(ledgerEntries.amount)}::numeric(14,2)::text`,
        })
        .from(ledgerEntries)
        .innerJoin(campaigns, eq(campaigns.id, ledgerEntries.campaignId))
        .where(eq(ledgerEntries.customerId, customerId))
        .groupBy(ledgerEntries.campaignId, campaigns.startsOn);
      return rows.map((row) => ({ ...row, balance: Money.parse(row.balance) }));
    },
  };
}
