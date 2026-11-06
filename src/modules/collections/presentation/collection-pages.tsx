import { ChevronRightIcon, PercentIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "cn";
import { campaignOn } from "@/modules/campaigns/domain/campaign";
import { listCampaigns } from "@/modules/campaigns/application/campaign-use-cases";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { customerOptions } from "@/modules/customers/application/customer-use-cases";
import { formatCustomerCode } from "@/modules/customers/domain/customer";
import { customerDeps } from "@/modules/customers/presentation/customer-deps";
import { customerPath } from "@/modules/customers/presentation/customer-routes";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { listNotes } from "@/modules/sales/application/note-use-cases";
import { noteDeps } from "@/modules/sales/presentation/note-deps";
import { notePath } from "@/modules/sales/presentation/note-routes";
import type { Actor } from "@/shared/application/actor";
import { MAX_PAGES } from "@/shared/application/pagination";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { todayInBolivia } from "@/shared/presentation/business-date";
import { EmptyState } from "@/shared/presentation/empty-state";
import { FormSectionSkeleton } from "@/shared/presentation/form-section";
import { formatDate, formatDateTime, formatMoney, formatRate } from "@/shared/presentation/format";
import { ListPages, listHref, pageRows } from "@/shared/presentation/list-pages";
import { LiveFilterForm } from "@/shared/presentation/live-filter-form";
import { PdfActions } from "@/shared/presentation/pdf-actions";
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
import {
  customerBalances,
  dailyRate,
  getPayment,
  listCharges,
  listPayments,
} from "../application/collection-use-cases";
import type { DocumentStatus } from "../application/collection-ports";
import { ChargeForm } from "./charge-form";
import { DailyRateForm, VoidChargeButton, VoidPaymentButton } from "./collection-controls";
import { collectionDeps } from "./collection-deps";
import { METHOD_LABELS, formatAmount } from "./collection-labels";
import { CHARGES_PATH, PAYMENTS_PATH, paymentPath, receiptPdfPath } from "./collection-routes";
import { PaymentForm } from "./payment-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const deps = () => collectionDeps(getDb());
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function StatusBadge({ status }: { status: DocumentStatus }) {
  return status === "voided" ? (
    <Badge variant="destructive">Anulado</Badge>
  ) : (
    <Badge variant="success">Vigente</Badge>
  );
}

async function campaignOptions(actor: Actor) {
  const campaigns = await listCampaigns({ campaigns: drizzleCampaignRepository(getDb()) }, actor);
  return campaigns.map((campaign) => ({ ...campaign, label: campaignLabel(campaign) }));
}

export async function DailyRateCard() {
  const actor = await requireActor();
  const today = todayInBolivia();
  return <DailyRateForm today={today} rate={await dailyRate(deps(), actor, today)} />;
}

/** Search and status, the same for payments and charges. */
function DocumentFilters({
  action,
  text,
  status,
  placeholder,
  label,
}: {
  action: string;
  text: string;
  status: string;
  placeholder: string;
  label: string;
}) {
  return (
    <LiveFilterForm action={action} className="flex flex-wrap items-center gap-2">
      <SearchInput name="q" defaultValue={text} placeholder={placeholder} aria-label={label} />
      <NativeSelect name="status" defaultValue={status} aria-label="Estado">
        <NativeSelectOption value="">Todos</NativeSelectOption>
        <NativeSelectOption value="recorded">Vigentes</NativeSelectOption>
        <NativeSelectOption value="voided">Anulados</NativeSelectOption>
      </NativeSelect>
    </LiveFilterForm>
  );
}

export async function PaymentsTable({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actor = await requireActor();
  const text = first(params.q) ?? "";
  const status = first(params.status) ?? "";
  const list = await listPayments(deps(), actor, {
    text,
    status: status || undefined,
    page: first(params.page),
    pages: first(params.pages),
  });
  const { items } = list;

  return (
    <div className="flex flex-col gap-4">
      <DocumentFilters
        action={PAYMENTS_PATH}
        text={text}
        status={status}
        placeholder="Cliente o N.º de recibo"
        label="Buscar cobro"
      />
      {items.length === 0 ? (
        <EmptyState icon={<WalletIcon />} title={text || status ? "Sin resultados" : "Todavía no hay cobros"}>
          {text || status ? "Prueba con otro cliente, número o estado." : undefined}
        </EmptyState>
      ) : (
        <>
          <WideOnly>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Recibo</TableHead>
                  <TableHead className="w-28">Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">US$</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Abrir</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows(list).map((payment) => (
                  <TableRow key={payment.id} className="group relative">
                    <TableCell className="tabular-nums">
                      {/* The link covers the row, so the whole row opens the receipt. */}
                      <Link
                        href={paymentPath(payment.id)}
                        className="font-medium group-hover:text-primary after:absolute after:inset-0"
                      >
                        {payment.receiptNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDate(payment.paymentDate)}
                    </TableCell>
                    <TableCell className="font-medium">{payment.customerName}</TableCell>
                    <TableCell className="text-muted-foreground">{METHOD_LABELS[payment.method]}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAmount(payment.currency, payment.amount)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(payment.usdAmount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={payment.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <ChevronRightIcon
                        className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                        aria-hidden
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </WideOnly>
          <CardList label="Cobros">
            {items.map((payment) => (
              <CardListItem key={payment.id} className="relative">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={paymentPath(payment.id)}
                    className="min-w-0 truncate font-medium after:absolute after:inset-0"
                  >
                    N.º {payment.receiptNumber} · {payment.customerName}
                  </Link>
                  <StatusBadge status={payment.status} />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDate(payment.paymentDate)} · {METHOD_LABELS[payment.method]}
                </span>
                <CardField label="Monto">{formatAmount(payment.currency, payment.amount)}</CardField>
                <CardField label="US$">
                  <span className="font-medium">{formatMoney(payment.usdAmount)}</span>
                </CardField>
              </CardListItem>
            ))}
          </CardList>
        </>
      )}
      <ListPages
        list={list}
        href={(paging) => listHref(PAYMENTS_PATH, { q: text, status }, paging)}
        noun={["cobro", "cobros"]}
      />
    </div>
  );
}

/** The payments page while it loads: the day's rate, then the list laid out like `PaymentsTable`. */
export function PaymentsPageSkeleton() {
  return (
    <Loading label="Cargando cobros" className="gap-6">
      <div aria-hidden className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-xs">
        <Skeleton className="size-8 shrink-0 rounded-lg" />
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex flex-col gap-4">
        <FiltersSkeleton selects={1} />
        <TableSkeleton
          columns={[
            { shape: "short", className: "w-24" },
            { shape: "short", className: "w-28" },
            { shape: "text" },
            { shape: "short" },
            { shape: "short", align: "right" },
            { shape: "short", align: "right" },
            { shape: "badge" },
            { shape: "chevron", className: "w-10" },
          ]}
        />
        <CardListSkeleton lines={3} />
        <ListFooterSkeleton />
      </div>
    </Loading>
  );
}

export async function NewPayment({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actor = await requireActor();
  const today = todayInBolivia();
  const [customers, campaigns, todayRate] = await Promise.all([
    customerOptions(customerDeps(getDb()), actor),
    campaignOptions(actor),
    dailyRate(deps(), actor, today),
  ]);
  const chosen = customers.find((customer) => customer.id === first(params.customer));

  let customer = null;
  if (chosen) {
    const [balances, notes] = await Promise.all([
      customerBalances(deps(), actor, chosen.id),
      // Every note the payment could go to, not just one page of them.
      listNotes(noteDeps(getDb()), actor, { status: "confirmed", customerId: chosen.id, pages: MAX_PAGES }),
    ]);
    const labels = new Map(campaigns.map((campaign) => [campaign.id, campaign.label]));
    customer = {
      id: chosen.id,
      fixedExchangeRate: chosen.fixedExchangeRate,
      balances: balances.map((row) => ({
        campaignId: row.campaignId,
        label: labels.get(row.campaignId) ?? "",
        balance: row.balance.toDecimalString(),
      })),
      notes: notes.items.map((note) => ({
        id: note.id,
        number: note.number,
        noteDate: note.noteDate,
        total: note.total,
      })),
    };
  }

  return (
    <PaymentForm
      // A different customer brings different defaults (rate, balances), so the form starts over.
      key={customer?.id ?? "none"}
      customers={customers}
      customer={customer}
      campaigns={campaigns.map(({ id, label }) => ({ id, label }))}
      today={today}
      todayRate={todayRate}
    />
  );
}

/** The payment form while it loads: only the customer shows until one is chosen. */
export function PaymentFormSkeleton() {
  return (
    <Loading label="Cargando formulario de cobro" className="max-w-4xl gap-6">
      <FormSectionSkeleton>
        <Skeleton className="my-0.5 h-3.5 w-16" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </FormSectionSkeleton>
    </Loading>
  );
}

export async function PaymentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  const payment = await getPayment(deps(), actor, id).catch((error: unknown) => {
    if (isDomainError(error) && (error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED"))
      notFound();
    throw error;
  });

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <article className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b p-5">
          <div className="min-w-0">
            <h2>
              <span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Recibo de pago
              </span>
              <span className="mt-1 block text-2xl font-semibold tracking-tight tabular-nums">
                N.º {payment.receiptNumber}
              </span>
            </h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <StatusBadge status={payment.status} />
              <span className="tabular-nums">{formatDate(payment.paymentDate)}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <PdfActions href={receiptPdfPath(payment.id)} fileName={`recibo-${payment.receiptNumber}.pdf`} />
            {payment.status === "recorded" && !payment.settlesNote && (
              <VoidPaymentButton paymentId={payment.id} receiptNumber={payment.receiptNumber} />
            )}
          </div>
        </header>
        {payment.voided && (
          <div className="border-b border-destructive/25 bg-destructive/5 px-5 py-3 text-sm">
            <p className="font-medium">
              Anulado el {formatDateTime(payment.voided.at)}
              {payment.voided.byName && ` por ${payment.voided.byName}`}
            </p>
            <p className="mt-1 text-muted-foreground">Motivo: {payment.voided.reason}</p>
          </div>
        )}
        <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Cliente</p>
            <Link
              href={customerPath(payment.customer.id)}
              className="mt-1 block text-base font-semibold hover:text-primary"
            >
              {payment.customer.name}
            </Link>
            <p className="font-mono text-xs text-muted-foreground">
              {formatCustomerCode(payment.customer.code)}
            </p>
          </div>
          <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <Item label="Forma de pago">
              {METHOD_LABELS[payment.method]}
              {payment.inKindDescription && (
                <span className="block text-xs font-normal text-muted-foreground">
                  {payment.inKindDescription}
                </span>
              )}
            </Item>
            <Item label="Referencia">{payment.reference}</Item>
            {payment.settlesNote && (
              <Item label="Boleta al contado">
                <Link href={notePath(payment.settlesNote.id)} className="hover:text-primary">
                  N.º {payment.settlesNote.number}
                </Link>
              </Item>
            )}
            <Item label="Registrado">
              <span className="tabular-nums">{formatDateTime(payment.recorded.at)}</span>
              {payment.recorded.byName && (
                <span className="block text-xs font-normal text-muted-foreground">
                  {payment.recorded.byName}
                </span>
              )}
            </Item>
            <Item label="Observaciones" className="sm:col-span-2">
              {payment.observations && (
                <span className="font-normal whitespace-pre-line">{payment.observations}</span>
              )}
            </Item>
          </dl>
        </div>
      </article>

      <dl className="flex flex-col gap-1 self-end rounded-xl border bg-card px-5 py-4 shadow-xs sm:min-w-72">
        <div className="flex items-baseline justify-between gap-6">
          <dt className="text-sm text-muted-foreground">Recibido</dt>
          <dd className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatAmount(payment.currency, payment.amount)}
          </dd>
        </div>
        {payment.currency === "BOB" && (
          <div className="flex items-baseline justify-between gap-6 text-sm">
            <dt className="text-muted-foreground">A {formatRate(payment.exchangeRate)} Bs por US$</dt>
            <dd className="font-medium tabular-nums">US$ {formatMoney(payment.usdAmount)}</dd>
          </div>
        )}
      </dl>

      <section
        aria-labelledby="payment-allocations"
        className="overflow-hidden rounded-xl border bg-card shadow-xs"
      >
        <h3 id="payment-allocations" className="border-b px-5 py-3 text-sm font-semibold">
          Aplicado a
        </h3>
        <ul className="divide-y text-sm">
          {payment.allocations.map((allocation, index) => (
            <li key={index} className="flex items-center justify-between gap-4 px-5 py-3">
              <span className="min-w-0">
                <span className="font-medium">Campaña {campaignLabel(allocation.campaign)}</span>
                {allocation.note && (
                  <Link
                    href={notePath(allocation.note.id)}
                    className="block text-muted-foreground hover:text-primary"
                  >
                    Boleta N.º {allocation.note.number}
                  </Link>
                )}
              </span>
              <span className="font-medium tabular-nums">US$ {formatMoney(allocation.usdAmount)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** A receipt while it loads, card by card like `PaymentDetail`. */
export function PaymentDetailSkeleton() {
  return (
    <Loading label="Cargando recibo" className="max-w-4xl gap-6">
      <div aria-hidden className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="flex flex-col gap-2 border-b p-5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-28" />
          <div className="mt-1 flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        </div>
        <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex flex-col gap-1">
                <Skeleton className="my-0.5 h-3 w-20" />
                <Skeleton className="my-0.5 h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div
        aria-hidden
        className="flex h-[4.5rem] w-full max-w-72 items-center justify-between gap-6 self-end rounded-xl border bg-card px-5 shadow-xs"
      >
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-7 w-28" />
      </div>
      <div aria-hidden className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="border-b px-5 py-3.5">
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-3.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </Loading>
  );
}

export async function ChargesTable({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const actor = await requireActor();
  const text = first(params.q) ?? "";
  const status = first(params.status) ?? "";
  const list = await listCharges(deps(), actor, {
    text,
    status: status || undefined,
    page: first(params.page),
    pages: first(params.pages),
  });
  const { items } = list;

  return (
    <div className="flex flex-col gap-4">
      <DocumentFilters
        action={CHARGES_PATH}
        text={text}
        status={status}
        placeholder="Cliente"
        label="Buscar cargo"
      />
      {items.length === 0 ? (
        <EmptyState
          icon={<PercentIcon />}
          title={text || status ? "Sin resultados" : "Todavía no hay cargos"}
        >
          {text || status ? "Prueba con otro cliente o estado." : undefined}
        </EmptyState>
      ) : (
        <>
          <WideOnly>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Campaña</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">US$</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows(list).map((charge) => (
                  <TableRow key={charge.id}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDate(charge.chargeDate)}
                    </TableCell>
                    <TableCell className="font-medium">{charge.customer.name}</TableCell>
                    <TableCell className="text-muted-foreground">{campaignLabel(charge.campaign)}</TableCell>
                    <TableCell className="max-w-80 whitespace-normal">
                      {charge.reason}
                      {charge.voided && (
                        <span className="block text-xs text-muted-foreground">
                          Anulado: {charge.voided.reason}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(charge.usdAmount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={charge.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {charge.status === "recorded" && <VoidChargeButton chargeId={charge.id} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </WideOnly>
          <CardList label="Cargos">
            {items.map((charge) => (
              <CardListItem key={charge.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{charge.customer.name}</span>
                  <StatusBadge status={charge.status} />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDate(charge.chargeDate)} · {campaignLabel(charge.campaign)}
                </span>
                <span>
                  {charge.reason}
                  {charge.voided && (
                    <span className="block text-xs text-muted-foreground">
                      Anulado: {charge.voided.reason}
                    </span>
                  )}
                </span>
                <CardField label="US$">
                  <span className="font-medium">{formatMoney(charge.usdAmount)}</span>
                </CardField>
                {charge.status === "recorded" && (
                  <div className="pt-1">
                    <VoidChargeButton chargeId={charge.id} />
                  </div>
                )}
              </CardListItem>
            ))}
          </CardList>
        </>
      )}
      <ListPages
        list={list}
        href={(paging) => listHref(CHARGES_PATH, { q: text, status }, paging)}
        noun={["cargo", "cargos"]}
      />
    </div>
  );
}

/** The charges list while it loads, laid out like `ChargesTable`. */
export function ChargesTableSkeleton() {
  return (
    <Loading label="Cargando cargos">
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

export async function NewCharge() {
  const actor = await requireActor();
  const today = todayInBolivia();
  const [customers, campaigns] = await Promise.all([
    customerOptions(customerDeps(getDb()), actor),
    campaignOptions(actor),
  ]);
  const open = campaigns.filter((campaign) => campaign.status === "open");
  return (
    <ChargeForm
      customers={customers}
      campaigns={open.map(({ id, label }) => ({ id, label }))}
      today={today}
      currentCampaignId={campaignOn(open, today)?.id ?? null}
    />
  );
}

/** The charge form while it loads, laid out like `ChargeForm`. */
export function ChargeFormSkeleton() {
  return (
    <Loading label="Cargando formulario de cargo" className="max-w-3xl gap-6">
      <FormSectionSkeleton>
        <Skeleton className="my-0.5 h-3.5 w-16" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="grid gap-5 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="my-0.5 h-3.5 w-24" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <Skeleton className="my-0.5 h-3.5 w-16" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </FormSectionSkeleton>
      <div aria-hidden className="flex gap-3">
        <Skeleton className="h-9 w-36 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
    </Loading>
  );
}

function Item({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 font-medium">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
