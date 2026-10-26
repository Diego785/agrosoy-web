import { desc, eq } from "drizzle-orm";
import { DomainError } from "@/shared/domain/domain-error";
import type { DbExecutor } from "@/shared/infrastructure/db/client";
import { violatedUniqueConstraint } from "@/shared/infrastructure/db/postgres-errors";
import type { Campaign, CampaignRepository } from "../application/campaign-ports";
import { CAMPAIGN_SEASON_YEAR_KEY, campaigns } from "./campaigns.table";

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

function toCampaign(row: typeof campaigns.$inferSelect): Campaign {
  return {
    id: row.id,
    season: row.season,
    year: row.year,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
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
