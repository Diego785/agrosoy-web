import type { CampaignRecord } from "../domain/campaign";

export type Campaign = CampaignRecord & { id: string; status: "open" | "closed" };

/** A customer's later due date in one campaign (D37). */
export type DueDateExtension = {
  customerId: string;
  campaignId: string;
  dueOn: string;
  reason: string;
};

export interface DueDateExtensionRepository {
  /** Adds the customer's extension in the campaign, or replaces the one they had. */
  save(extension: DueDateExtension, actorId: string): Promise<void>;
  /** NOT_FOUND when the customer has none in the campaign. */
  remove(customerId: string, campaignId: string): Promise<void>;
  find(customerId: string, campaignId: string): Promise<DueDateExtension | undefined>;
}

export interface CampaignRepository {
  /** Throws DomainError "DUPLICATE" (field "year") when the season and year already exist. */
  insert(campaign: CampaignRecord): Promise<{ id: string }>;
  /** Same duplicate rule; NOT_FOUND when missing. */
  update(id: string, campaign: CampaignRecord): Promise<void>;
  findById(id: string): Promise<Campaign | undefined>;
  /** Newest first. */
  list(): Promise<Campaign[]>;
}
