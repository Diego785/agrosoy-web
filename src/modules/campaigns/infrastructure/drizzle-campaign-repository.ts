import { and, desc, eq } from "drizzle-orm";
import { DomainError } from "@/shared/domain/domain-error";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import { violatedUniqueConstraint } from "@/shared/infrastructure/db/postgres-errors";
import type { Campaign, CampaignRepository, DueDateExtensionRepository } from "../application/campaign-ports";
import { customers } from "@/modules/customers/infrastructure/customers.tables";
import { CAMPAIGN_SEASON_YEAR_KEY, campaigns, dueDateExtensions } from "./campaigns.table";

export function drizzleCampaignRepository(executor: DbExecutor): CampaignRepository {
  return {
    async insert(campaign) {
      const [row] = await withDuplicateCheck(() =>
        executor.insert(campaigns).values(campaign).returning({ id: campaigns.id }),
      );
      if (!row) throw new Error("Insert returned no campaign");
      return row;
    },

    async update(id, campaign) {
      const rows = await withDuplicateCheck(() =>
        executor.update(campaigns).set(campaign).where(eq(campaigns.id, id)).returning({ id: campaigns.id }),
      );
      if (rows.length === 0) throw new DomainError("NOT_FOUND", { entity: "campaign", id });
    },

    async setStatus(id, status) {
      const rows = await executor
        .update(campaigns)
        .set({ status })
        .where(eq(campaigns.id, id))
        .returning({ id: campaigns.id });
      if (rows.length === 0) throw new DomainError("NOT_FOUND", { entity: "campaign", id });
    },

    async findById(id) {
      const [row] = await executor.select().from(campaigns).where(eq(campaigns.id, id));
      return row ? toCampaign(row) : undefined;
    },

    async list() {
      const rows = await executor.select().from(campaigns).orderBy(desc(campaigns.startsOn));
      return rows.map(toCampaign);
    },
  };
}

/** What a due-date extension needs from customers: only that the customer exists. */
export function customerExistence(executor: DbExecutor) {
  return {
    async exists(id: string) {
      const [row] = await executor.select({ id: customers.id }).from(customers).where(eq(customers.id, id));
      return row !== undefined;
    },
  };
}

export function drizzleDueDateExtensionRepository(executor: DbExecutor): DueDateExtensionRepository {
  const match = (customerId: string, campaignId: string) =>
    and(eq(dueDateExtensions.customerId, customerId), eq(dueDateExtensions.campaignId, campaignId));
  return {
    async save(extension, actorId) {
      await executor
        .insert(dueDateExtensions)
        .values({ ...extension, createdBy: actorId })
        .onConflictDoUpdate({
          target: [dueDateExtensions.customerId, dueDateExtensions.campaignId],
          set: {
            dueOn: extension.dueOn,
            reason: extension.reason,
            createdBy: actorId,
            updatedAt: new Date(),
          },
        });
    },

    async remove(customerId, campaignId) {
      const removed = await executor
        .delete(dueDateExtensions)
        .where(match(customerId, campaignId))
        .returning({ id: dueDateExtensions.id });
      if (removed.length === 0) throw new DomainError("NOT_FOUND", { entity: "due_date_extension" });
    },

    async find(customerId, campaignId) {
      const [row] = await executor
        .select({
          customerId: dueDateExtensions.customerId,
          campaignId: dueDateExtensions.campaignId,
          dueOn: dueDateExtensions.dueOn,
          reason: dueDateExtensions.reason,
        })
        .from(dueDateExtensions)
        .where(match(customerId, campaignId));
      return row;
    },
  };
}

function toCampaign(row: typeof campaigns.$inferSelect): Campaign {
  return {
    id: row.id,
    season: row.season,
    year: row.year,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    dueOn: row.dueOn,
    status: row.status,
  };
}

async function withDuplicateCheck<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (violatedUniqueConstraint(error) === CAMPAIGN_SEASON_YEAR_KEY) {
      throw new DomainError("DUPLICATE", { field: "year" });
    }
    throw error;
  }
}
