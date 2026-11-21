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
import type { Campaign } from "../application/campaign-ports";
import { getCampaign, listCampaigns } from "../application/campaign-use-cases";
import { campaignOn, type Season } from "../domain/campaign";
import { drizzleCampaignRepository } from "../infrastructure/drizzle-campaign-repository";
import { CampaignForm } from "./campaign-form";
import { campaignLabel } from "./campaign-labels";
import { CampaignStatusButton } from "./campaign-status-button";
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
  // Each campaign opens its page: the form while open, reopening once closed. The link covers the
  // row, so the whole row is clickable.
  const name = (campaign: (typeof campaigns)[number]) =>
    canEdit ? (
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
              <TableHead>Vence la deuda</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Abrir</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => (
              <TableRow key={campaign.id} className={canEdit ? "group relative" : undefined}>
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
                <TableCell className="tabular-nums">{formatDate(campaign.dueOn)}</TableCell>
                <TableCell>{status(campaign)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {canEdit && (
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
          <CardListItem key={campaign.id} className={canEdit ? "relative gap-2" : "gap-2"}>
            <div className="flex items-center gap-3">
              <SeasonMark season={campaign.season} />
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {name(campaign)}
                {campaign.id === current?.id && currentBadge}
              </span>
              {status(campaign)}
              {canEdit && <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
            </div>
            <CardField label="Del">
              {formatDate(campaign.startsOn)} al {formatDate(campaign.endsOn)}
            </CardField>
            <CardField label="Vence la deuda">{formatDate(campaign.dueOn)}</CardField>
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
  if (campaign.status === "closed") return <ClosedCampaign campaign={campaign} />;
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <CampaignForm campaign={campaign} />
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Cierre</h3>
          <p className="text-sm text-muted-foreground">
            No se cierra sola: ciérrala cuando ninguna zona venda más en ella.
          </p>
        </div>
        <CampaignStatusButton campaign={campaign} />
      </section>
    </div>
  );
}

/** A closed campaign can't be edited: its dates, and the way back to using it. */
function ClosedCampaign({ campaign }: { campaign: Campaign }) {
  return (
    <section className="flex max-w-xl flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex items-center gap-3">
        <SeasonMark season={campaign.season} />
        <span className="font-medium">{campaignLabel(campaign)}</span>
        <Badge variant="neutral">Cerrada</Badge>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <span>
          Del <span className="tabular-nums">{formatDate(campaign.startsOn)}</span> al{" "}
          <span className="tabular-nums">{formatDate(campaign.endsOn)}</span>
        </span>
        <span>
          Vence la deuda el <span className="tabular-nums">{formatDate(campaign.dueOn)}</span>
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        No admite documentos nuevos con fecha dentro de ella; su deuda se sigue cobrando. Para cambiar sus
        fechas o volver a usarla, reábrela.
      </p>
      <div>
        <CampaignStatusButton campaign={campaign} />
      </div>
    </section>
  );
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
