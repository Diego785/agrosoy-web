import { LandmarkIcon } from "lucide-react";
import { listCampaigns } from "@/modules/campaigns/application/campaign-use-cases";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { customerOptions } from "@/modules/customers/application/customer-use-cases";
import { customerDeps } from "@/modules/customers/presentation/customer-deps";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { Money } from "@/shared/domain/money";
import { getDb } from "@/shared/infrastructure/db/client";
import { todayInBolivia } from "@/shared/presentation/business-date";
import { EmptyState } from "@/shared/presentation/empty-state";
import { FormSectionSkeleton } from "@/shared/presentation/form-section";
import { formatDate, formatMoney } from "@/shared/presentation/format";
import { ListPages, listHref, pageRows } from "@/shared/presentation/list-pages";
import { LiveFilterForm } from "@/shared/presentation/live-filter-form";
import { CardField, CardList, CardListItem, WideOnly } from "@/shared/presentation/responsive-list";
import { SearchInput } from "@/shared/presentation/search-input";
import {
  CardListSkeleton,
  FiltersSkeleton,
  ListFooterSkeleton,
  Loading,
  Skeleton,
  TableSkeleton,
} from "@/shared/presentation/skeletons";
import { Badge } from "@/shared/presentation/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import type { OpeningBalanceView } from "../application/collection-ports";
import { listOpeningBalances } from "../application/opening-balances";
import { VoidOpeningBalanceButton } from "./collection-controls";
import { collectionDeps } from "./collection-deps";
import { OPENING_BALANCES_PATH } from "./collection-routes";
import { OpeningBalanceForm } from "./opening-balance-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** "1.500,00", or "a favor 200,00" when the customer starts in their favor. */
function amountText(balance: OpeningBalanceView): string {
  const amount = Money.parse(balance.usdAmount);
  return amount.isNegative()
    ? `a favor ${formatMoney(amount.negate().toDecimalString())}`
    : formatMoney(balance.usdAmount);
}

function StatusBadge({ balance }: { balance: OpeningBalanceView }) {
  return balance.status === "voided" ? (
    <Badge variant="destructive">Anulado</Badge>
  ) : (
    <Badge variant="success">Vigente</Badge>
  );
}

/** Opening balances (D29): debt carried in at go-live, per customer and campaign. */
export async function OpeningBalancesTable({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actor = await requireActor();
  const text = first(params.q) ?? "";
  const status = first(params.status) ?? "";
  const list = await listOpeningBalances(collectionDeps(getDb()), actor, {
    text,
    status: status || undefined,
    page: first(params.page),
    pages: first(params.pages),
  });
  const { items } = list;

  return (
    <div className="flex flex-col gap-4">
      <LiveFilterForm action={OPENING_BALANCES_PATH} className="flex flex-wrap items-center gap-2">
        <SearchInput name="q" defaultValue={text} placeholder="Cliente" aria-label="Buscar saldo inicial" />
        <NativeSelect name="status" defaultValue={status} aria-label="Estado">
          <NativeSelectOption value="">Todos</NativeSelectOption>
          <NativeSelectOption value="recorded">Vigentes</NativeSelectOption>
          <NativeSelectOption value="voided">Anulados</NativeSelectOption>
        </NativeSelect>
      </LiveFilterForm>
      {items.length === 0 ? (
        <EmptyState
          icon={<LandmarkIcon />}
          title={text || status ? "Sin resultados" : "Todavía no hay saldos iniciales"}
        >
          {text || status
            ? "Prueba con otro cliente o estado."
            : "Úsalos para la deuda anterior al sistema que no viene en una planilla."}
        </EmptyState>
      ) : (
        <>
          <WideOnly>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Al día</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Campaña</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead className="text-right">US$</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows(list).map((balance) => (
                  <TableRow key={balance.id}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDate(balance.balanceDate)}
                    </TableCell>
                    <TableCell className="font-medium">{balance.customer.name}</TableCell>
                    <TableCell className="text-muted-foreground">{campaignLabel(balance.campaign)}</TableCell>
                    <TableCell className="max-w-80 whitespace-normal">
                      {balance.note ?? <span className="text-muted-foreground">—</span>}
                      {balance.voided && (
                        <span className="block text-xs text-muted-foreground">
                          Anulado: {balance.voided.reason}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {amountText(balance)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge balance={balance} />
                    </TableCell>
                    <TableCell className="text-right">
                      {balance.status === "recorded" && (
                        <VoidOpeningBalanceButton openingBalanceId={balance.id} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </WideOnly>
          <CardList label="Saldos iniciales">
            {items.map((balance) => (
              <CardListItem key={balance.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{balance.customer.name}</span>
                  <StatusBadge balance={balance} />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDate(balance.balanceDate)} · {campaignLabel(balance.campaign)}
                </span>
                {balance.note && <span>{balance.note}</span>}
                <CardField label="US$">
                  <span className="font-medium">{amountText(balance)}</span>
                </CardField>
                {balance.status === "recorded" && (
                  <div className="pt-1">
                    <VoidOpeningBalanceButton openingBalanceId={balance.id} />
                  </div>
                )}
              </CardListItem>
            ))}
          </CardList>
        </>
      )}
      <ListPages
        list={list}
        href={(paging) => listHref(OPENING_BALANCES_PATH, { q: text, status }, paging)}
        noun={["saldo inicial", "saldos iniciales"]}
      />
    </div>
  );
}

/** The opening balances while they load, laid out like `OpeningBalancesTable`. */
export function OpeningBalancesTableSkeleton() {
  return (
    <Loading label="Cargando saldos iniciales">
      <FiltersSkeleton selects={1} />
      <TableSkeleton
        columns={[
          { shape: "short", className: "w-28" },
          { shape: "text" },
          { shape: "short" },
          { shape: "text" },
          { shape: "short", align: "right" },
          { shape: "badge" },
          { shape: "short", align: "right" },
        ]}
      />
      <CardListSkeleton lines={3} />
      <ListFooterSkeleton />
    </Loading>
  );
}

export async function NewOpeningBalance() {
  const actor = await requireActor();
  const [customers, campaigns] = await Promise.all([
    customerOptions(customerDeps(getDb()), actor),
    listCampaigns({ campaigns: drizzleCampaignRepository(getDb()) }, actor),
  ]);
  return (
    <OpeningBalanceForm
      customers={customers}
      campaigns={campaigns.map((campaign) => ({ id: campaign.id, label: campaignLabel(campaign) }))}
      today={todayInBolivia()}
    />
  );
}

/** The opening balance form while it loads. */
export function OpeningBalanceFormSkeleton() {
  return (
    <Loading label="Cargando formulario de saldo inicial" className="max-w-3xl gap-6">
      <FormSectionSkeleton>
        <Skeleton className="my-0.5 h-3.5 w-16" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="grid gap-5 sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="my-0.5 h-3.5 w-24" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <Skeleton className="my-0.5 h-3.5 w-16" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </FormSectionSkeleton>
    </Loading>
  );
}
