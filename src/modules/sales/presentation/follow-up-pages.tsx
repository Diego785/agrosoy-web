import { PackageOpenIcon } from "lucide-react";
import { listCampaigns } from "@/modules/campaigns/application/campaign-use-cases";
import { campaignOn, previousCampaign } from "@/modules/campaigns/domain/campaign";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { contentLabel } from "@/modules/catalog/presentation/catalog-labels";
import { customerOptions } from "@/modules/customers/application/customer-use-cases";
import { formatCustomerCode } from "@/modules/customers/domain/customer";
import { customerDeps } from "@/modules/customers/presentation/customer-deps";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { getDb } from "@/shared/infrastructure/db/client";
import { todayInBolivia } from "@/shared/presentation/business-date";
import { EmptyState } from "@/shared/presentation/empty-state";
import { formatDate, trimDecimalZeros } from "@/shared/presentation/format";
import { LiveFilterForm } from "@/shared/presentation/live-filter-form";
import { FiltersSkeleton, Loading, TableSkeleton } from "@/shared/presentation/skeletons";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import { followUpOptions, sourceLabel } from "../application/note-follow-ups";
import { FollowUpForm } from "./follow-up-form";
import { noteDeps } from "./note-deps";
import { loadNoteFormOptions } from "./note-form-options";
import { followUpPath } from "./note-routes";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * A return or transfer (D25): first whose product and from which campaign, then every line the
 * customer still holds from it, whichever delivery it came on.
 */
export async function FollowUpPage({
  searchParams,
  mode,
}: {
  searchParams: SearchParams;
  mode: "return" | "transfer";
}) {
  const params = await searchParams;
  const actor = await requireActor();
  const db = getDb();
  const today = todayInBolivia();
  const [customers, campaigns] = await Promise.all([
    customerOptions(customerDeps(db), actor),
    listCampaigns({ campaigns: drizzleCampaignRepository(db) }, actor),
  ]);
  const current = campaignOn(campaigns, today);
  // A return is usually of this campaign's product; a transfer carries the last one's over.
  const usual = mode === "return" ? current : current && previousCampaign(campaigns, current);
  const customer = customers.find((option) => option.id === first(params.customer));
  const campaign = campaigns.find((option) => option.id === first(params.campaign)) ?? usual ?? campaigns[0];
  const path = followUpPath(mode);

  const picker = (
    <LiveFilterForm action={path} className="flex flex-wrap items-center gap-2">
      <NativeSelect name="customer" defaultValue={customer?.id ?? ""} aria-label="Cliente">
        <NativeSelectOption value="">Elegir cliente…</NativeSelectOption>
        {customers.map((option) => (
          <NativeSelectOption key={option.id} value={option.id}>
            {formatCustomerCode(option.code)} · {option.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect name="campaign" defaultValue={campaign?.id ?? ""} aria-label="Campaña del producto">
        {campaigns.map((option) => (
          <NativeSelectOption key={option.id} value={option.id}>
            Producto de {campaignLabel(option)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </LiveFilterForm>
  );

  if (!customer || !campaign) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        {picker}
        <EmptyState icon={<PackageOpenIcon />} title="Elige el cliente">
          Aparece todo lo que recibió en la campaña y todavía no devolvió ni pasó, boleta por boleta.
        </EmptyState>
      </div>
    );
  }

  const lines = (
    await followUpOptions(noteDeps(db), actor, {
      customerId: customer.id,
      campaignId: campaign.id,
    })
  ).filter((line) => mode === "return" || line.freeOfCharge === null);
  if (lines.length === 0) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        {picker}
        <EmptyState icon={<PackageOpenIcon />} title="No le queda producto de esa campaña">
          {mode === "return"
            ? `${customer.name} no tiene nada por devolver de ${campaignLabel(campaign)}.`
            : `${customer.name} no tiene nada que pasar de ${campaignLabel(campaign)}; las bonificaciones y muestras no se pasan.`}
        </EmptyState>
      </div>
    );
  }

  // A transfer suggests the new campaign's reference price for the customer's zone, and the rate.
  let suggested: Record<string, string> = {};
  let exchangeRate = "";
  if (mode === "transfer") {
    const formOptions = await loadNoteFormOptions(actor);
    const zoneId = formOptions.customers.find((option) => option.id === customer.id)?.zoneId ?? "";
    const target = campaignOn(formOptions.campaigns, today);
    const byZone = target ? (formOptions.prices[target.id] ?? {}) : {};
    suggested = { ...byZone[""], ...byZone[zoneId] };
    const rate = customer.fixedExchangeRate ?? formOptions.currentRate;
    if (rate) exchangeRate = trimDecimalZeros(rate);
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {picker}
      <FollowUpForm
        key={`${customer.id}|${campaign.id}`}
        mode={mode}
        target={{ customerId: customer.id, campaignId: campaign.id }}
        today={today}
        defaults={{ receiverName: customer.name, exchangeRate }}
        lines={lines.map((line) => ({
          id: line.id,
          source: `${sourceLabel(line.source)} · ${formatDate(line.source.noteDate)}${
            line.source.type === "campaign_transfer" ? " · traspaso" : ""
          }`,
          label: `${line.productName} · ${contentLabel(line)}${line.freeOfCharge ? " (sin cargo)" : ""}`,
          delivered: line.quantity.toDecimalString(),
          remaining: line.quantity.subtract(line.settled).toDecimalString(),
          unitPrice: line.unitPrice.toDecimalString(),
          isFree: line.freeOfCharge !== null,
          suggestedPrice: suggested[line.presentationId] ?? "",
        }))}
      />
    </div>
  );
}

/** The return or transfer form while it loads. */
export function FollowUpPageSkeleton() {
  return (
    <Loading label="Cargando productos del cliente" className="max-w-4xl">
      <FiltersSkeleton selects={2} search={false} />
      <TableSkeleton
        rows={5}
        columns={[
          { shape: "text" },
          { shape: "short", align: "right" },
          { shape: "short", align: "right" },
          { shape: "short", align: "right" },
          { shape: "short", className: "w-32" },
        ]}
      />
    </Loading>
  );
}
