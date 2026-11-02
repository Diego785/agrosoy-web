import { CalendarRangeIcon, ChevronRightIcon, SnowflakeIcon, SunIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "cn";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { can } from "@/shared/application/permissions";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { todayInBolivia } from "@/shared/presentation/business-date";
import { EmptyState } from "@/shared/presentation/empty-state";
import { formatDate } from "@/shared/presentation/format";
import { CardField, CardList, CardListItem, WideOnly } from "@/shared/presentation/responsive-list";
import {
  CardListSkeleton,
  FieldsSkeleton,
  Loading,
  Skeleton,
  TableSkeleton,
} from "@/shared/presentation/skeletons";
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
import { campaignOn, type Season } from "../domain/campaign";
import { drizzleCampaignRepository } from "../infrastructure/drizzle-campaign-repository";
import { CampaignForm } from "./campaign-form";
import { campaignLabel } from "./campaign-labels";
import { editCampaignPath } from "./campaign-routes";

const SEASON_LOOK: Record<Season, { icon: LucideIcon; tile: string }> = {
  summer: { icon: SunIcon, tile: "bg-warning/14 text-warning" },
  winter: { icon: SnowflakeIcon, tile: "bg-info/10 text-info" },
};

/** The season as a small tile: a sun for summer, a snowflake for winter. */
function SeasonMark({ season }: { season: Season }) {
  const { icon: Icon, tile } = SEASON_LOOK[season];
  return (
    <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", tile)}>
      <Icon className="size-4" />
    </span>
  );
}

export async function CampaignsTable() {
  const actor = await requireActor();
  const campaigns = await listCampaigns({ campaigns: drizzleCampaignRepository(getDb()) }, actor);
  const current = campaignOn(campaigns, todayInBolivia());
  const canEdit = can(actor, "catalog.manage");

  if (campaigns.length === 0) {
    return <EmptyState icon={<CalendarRangeIcon />} title="Todavía no hay campañas." />;
  }
  const editable = (campaign: (typeof campaigns)[number]) => canEdit && campaign.status === "open";
  // An open campaign opens its edit form; the link covers the row, so the whole row is clickable.
  const name = (campaign: (typeof campaigns)[number]) =>
    editable(campaign) ? (
      <Link
        href={editCampaignPath(campaign.id)}
        className="font-medium group-hover:text-primary after:absolute after:inset-0"
      >
        {campaignLabel(campaign)}
      </Link>
    ) : (
      <span className="font-medium">{campaignLabel(campaign)}</span>
    );
  const status = (campaign: (typeof campaigns)[number]) =>
    campaign.status === "open" ? (
      <Badge variant="info">Abierta</Badge>
    ) : (
      <Badge variant="neutral">Cerrada</Badge>
    );
  const currentBadge = <Badge variant="success">En curso</Badge>;

  return (
    <>
      <WideOnly>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaña</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead>Hasta</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Abrir</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => (
              <TableRow key={campaign.id} className={editable(campaign) ? "group relative" : undefined}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <SeasonMark season={campaign.season} />
                    {name(campaign)}
                    {campaign.id === current?.id && currentBadge}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatDate(campaign.startsOn)}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatDate(campaign.endsOn)}
                </TableCell>
                <TableCell>{status(campaign)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {editable(campaign) && (
                    <ChevronRightIcon
                      className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                      aria-hidden
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </WideOnly>
      <CardList label="Campañas">
        {campaigns.map((campaign) => (
          <CardListItem key={campaign.id} className={editable(campaign) ? "relative gap-2" : "gap-2"}>
            <div className="flex items-center gap-3">
              <SeasonMark season={campaign.season} />
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {name(campaign)}
                {campaign.id === current?.id && currentBadge}
              </span>
              {status(campaign)}
              {editable(campaign) && (
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </div>
            <CardField label="Del">
              {formatDate(campaign.startsOn)} al {formatDate(campaign.endsOn)}
            </CardField>
          </CardListItem>
        ))}
      </CardList>
    </>
  );
}

/** The campaigns while they load, laid out like `CampaignsTable`; there are only a few a year. */
export function CampaignsTableSkeleton() {
  return (
    <Loading label="Cargando campañas">
      <TableSkeleton
        rows={4}
        columns={[
          { shape: "icon" },
          { shape: "short" },
          { shape: "short" },
          { shape: "badge" },
          { shape: "chevron", className: "w-10" },
        ]}
      />
      <CardListSkeleton rows={4} leading="icon" lines={1} />
    </Loading>
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

/** The campaign form while it loads, section by section like `CampaignForm`. */
export function CampaignFormSkeleton() {
  return (
    <Loading label="Cargando formulario">
      <div
        aria-hidden
        className="flex max-w-xl flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-xs"
      >
        {[0, 1].map((section) => (
          <div key={section} className="flex flex-col gap-4 p-5">
            <Skeleton className="my-0.5 h-4 w-24" />
            <FieldsSkeleton rows={[2]} />
          </div>
        ))}
        <div className="flex gap-3 bg-muted/30 px-5 py-4">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
    </Loading>
  );
}
