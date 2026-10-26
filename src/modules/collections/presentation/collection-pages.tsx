import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { campaignOn } from "@/modules/campaigns/domain/campaign";
import { listCampaigns } from "@/modules/campaigns/application/campaign-use-cases";
import { drizzleCampaignRepository } from "@/modules/campaigns/infrastructure/drizzle-campaign-repository";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { customerOptions } from "@/modules/customers/application/customer-use-cases";
import { formatCustomerCode } from "@/modules/customers/domain/customer";
import { customerDeps } from "@/modules/customers/presentation/customer-deps";
import { customerPath } from "@/modules/customers/presentation/customer-routes";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { PrintButton } from "@/modules/receivables/presentation/print-button";
import { listNotes } from "@/modules/sales/application/note-use-cases";
import { noteDeps } from "@/modules/sales/presentation/note-deps";
import { notePath } from "@/modules/sales/presentation/note-routes";
import type { Actor } from "@/shared/application/actor";
import { isDomainError } from "@/shared/domain/domain-error";
import { getDb } from "@/shared/infrastructure/db/client";
import { todayInBolivia } from "@/shared/presentation/business-date";
import { formatDate, formatDateTime, formatMoney, formatRate } from "@/shared/presentation/format";
import { Badge } from "@/shared/presentation/ui/badge";
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
import { paymentPath } from "./collection-routes";
import { PaymentForm } from "./payment-form";

const deps = () => collectionDeps(getDb());
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function StatusBadge({ status }: { status: DocumentStatus }) {
  return status === "voided" ? <Badge variant="outline">Anulado</Badge> : null;
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

export async function PaymentsTable({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const actor = await requireActor();
  const { items, total } = await listPayments(deps(), actor, { page: first(params.page) });

  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">Todavía no hay pagos registrados.</p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Recibo</TableHead>
            <TableHead className="w-28">Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Forma</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="text-right">US$</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((payment) => (
            <TableRow key={payment.id} className={payment.status === "voided" ? "text-muted-foreground" : ""}>
              <TableCell className="tabular-nums">
                <Link href={paymentPath(payment.id)} className="font-medium hover:underline">
                  {payment.receiptNumber}
                </Link>
              </TableCell>
              <TableCell className="tabular-nums">{formatDate(payment.paymentDate)}</TableCell>
              <TableCell>{payment.customerName}</TableCell>
              <TableCell>{METHOD_LABELS[payment.method]}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatAmount(payment.currency, payment.amount)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(payment.usdAmount)}</TableCell>
              <TableCell>
                <StatusBadge status={payment.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-sm text-muted-foreground">{total === 1 ? "1 pago" : `${total} pagos`}</p>
    </div>
  );
}

export async function NewPayment({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
      listNotes(noteDeps(getDb()), actor, { status: "confirmed", customerId: chosen.id }),
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

export async function PaymentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  const payment = await getPayment(deps(), actor, id).catch((error: unknown) => {
    if (isDomainError(error) && (error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED"))
      notFound();
    throw error;
  });

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Recibo N.º {payment.receiptNumber}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(payment.paymentDate)} · Registrado el {formatDateTime(payment.recorded.at)}
            {payment.recorded.byName && ` por ${payment.recorded.byName}`}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton />
          {payment.status === "recorded" && !payment.settlesNote && (
            <VoidPaymentButton paymentId={payment.id} receiptNumber={payment.receiptNumber} />
          )}
        </div>
      </header>

      {payment.voided && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          <p className="font-medium">
            Anulado el {formatDateTime(payment.voided.at)}
            {payment.voided.byName && ` por ${payment.voided.byName}`}
          </p>
          <p className="mt-1 text-muted-foreground">Motivo: {payment.voided.reason}</p>
        </div>
      )}

      <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <Item label="Cliente">
          <Link href={customerPath(payment.customer.id)} className="hover:underline">
            {formatCustomerCode(payment.customer.code)} · {payment.customer.name}
          </Link>
        </Item>
        <Item label="Monto">
          <span className="text-base font-semibold">{formatAmount(payment.currency, payment.amount)}</span>
          {payment.currency === "BOB" && (
            <span className="block text-muted-foreground">
              US$ {formatMoney(payment.usdAmount)} a {formatRate(payment.exchangeRate)} Bs por US$
            </span>
          )}
        </Item>
        <Item label="Forma de pago">
          {METHOD_LABELS[payment.method]}
          {payment.inKindDescription && ` · ${payment.inKindDescription}`}
        </Item>
        <Item label="Referencia">{payment.reference}</Item>
        {payment.settlesNote && (
          <Item label="Boleta al contado">
            <Link href={notePath(payment.settlesNote.id)} className="hover:underline">
              N.º {payment.settlesNote.number}
            </Link>
          </Item>
        )}
        <Item label="Observaciones">{payment.observations}</Item>
      </dl>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Aplicado a</h3>
        <ul className="flex flex-col gap-1 text-sm">
          {payment.allocations.map((allocation, index) => (
            <li key={index} className="tabular-nums">
              Campaña {campaignLabel(allocation.campaign)}
              {allocation.note && (
                <>
                  , boleta{" "}
                  <Link href={notePath(allocation.note.id)} className="hover:underline">
                    N.º {allocation.note.number}
                  </Link>
                </>
              )}
              : US$ {formatMoney(allocation.usdAmount)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export async function ChargesTable({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const actor = await requireActor();
  const { items, total } = await listCharges(deps(), actor, { page: first(params.page) });

  if (items.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Todavía no hay cargos.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Fecha</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Campaña</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead className="text-right">US$</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((charge) => (
            <TableRow key={charge.id} className={charge.status === "voided" ? "text-muted-foreground" : ""}>
              <TableCell className="tabular-nums">{formatDate(charge.chargeDate)}</TableCell>
              <TableCell>{charge.customer.name}</TableCell>
              <TableCell>{campaignLabel(charge.campaign)}</TableCell>
              <TableCell className="max-w-80 whitespace-normal">
                {charge.reason}
                {charge.voided && <span className="block text-xs">Anulado: {charge.voided.reason}</span>}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(charge.usdAmount)}</TableCell>
              <TableCell className="text-right">
                {charge.status === "recorded" ? (
                  <VoidChargeButton chargeId={charge.id} />
                ) : (
                  <StatusBadge status={charge.status} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-sm text-muted-foreground">{total === 1 ? "1 cargo" : `${total} cargos`}</p>
    </div>
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

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children || "—"}</dd>
    </div>
  );
}
