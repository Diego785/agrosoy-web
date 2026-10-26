export const CAMPAIGNS_PATH = "/campaigns";
export const NEW_CAMPAIGN_PATH = "/campaigns/new";

export function editCampaignPath(campaignId: string): string {
  return `${CAMPAIGNS_PATH}/${campaignId}`;
}
