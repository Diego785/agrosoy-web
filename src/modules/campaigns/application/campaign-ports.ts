import type { CampaignRecord } from "../domain/campaign";

export type Campaign = CampaignRecord & { id: string; status: "open" | "closed" };

export interface CampaignRepository {
  /** Throws DomainError "DUPLICATE" (field "year") when the season and year already exist. */
  insert(campaign: CampaignRecord): Promise<{ id: string }>;
  /** Same duplicate rule; NOT_FOUND when missing. */
  update(id: string, campaign: CampaignRecord): Promise<void>;
  findById(id: string): Promise<Campaign | undefined>;
  /** Newest first. */
  list(): Promise<Campaign[]>;
}
