import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { can } from "@/shared/application/permissions";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { todayInBolivia } from "@/shared/presentation/business-date";
import { formatDate } from "@/shared/presentation/format";
import { Badge } from "@/shared/presentation/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import { getCampaign, listCampaigns } from "../application/campaign-use-cases";
import { campaignOn } from "../domain/campaign";
import { drizzleCampaignRepository } from "../infrastructure/drizzle-campaign-repository";
import { CampaignForm } from "./campaign-form";
import { campaignLabel } from "./campaign-labels";
import { editCampaignPath } from "./campaign-routes";

export async function CampaignsTable() {
  const actor = await requireActor();
  const campaigns = await listCampaigns({ campaigns: drizzleCampaignRepository(getDb()) }, actor);
  const current = campaignOn(campaigns, todayInBolivia());
  const canEdit = can(actor, "catalog.manage");

  if (campaigns.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay campañas.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Campaña</TableHead>
          <TableHead>Desde</TableHead>
          <TableHead>Hasta</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((campaign) => (
          <TableRow key={campaign.id}>
            <TableCell className="font-medium">
              {canEdit && campaign.status === "open" ? (
                <Link href={editCampaignPath(campaign.id)} className="hover:underline">
                  {campaignLabel(campaign)}
                </Link>
              ) : (
                campaignLabel(campaign)
              )}
              {campaign.id === current?.id && (
                <Badge className="ml-2" variant="secondary">
                  Actual
                </Badge>
              )}
            </TableCell>
            <TableCell className="tabular-nums">{formatDate(campaign.startsOn)}</TableCell>
            <TableCell className="tabular-nums">{formatDate(campaign.endsOn)}</TableCell>
            <TableCell>{campaign.status === "open" ? "Abierta" : "Cerrada"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export async function EditCampaign({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  const campaign = await getCampaign({ campaigns: drizzleCampaignRepository(getDb()) }, actor, id).catch(
    (error: unknown) => {
      if (isDomainError(error) && (error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED"))
        notFound();
      throw error;
    },
  );
  return <CampaignForm campaign={campaign} />;
}
