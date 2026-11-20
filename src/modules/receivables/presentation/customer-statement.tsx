import Link from "next/link";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { ExtensionButton } from "@/modules/campaigns/presentation/extension-button";
import { Badge } from "@/shared/presentation/ui/badge";
import { paymentPath } from "@/modules/collections/presentation/collection-routes";
import { notePath } from "@/modules/sales/presentation/note-routes";
import { Money } from "@/shared/domain/money";
import { formatDate, formatMoney, formatQuantity, formatRate, formatUsd } from "@/shared/presentation/format";
import { CardField, CardList, CardListItem, WideOnly } from "@/shared/presentation/responsive-list";
import { CardListSkeleton, TableSkeleton } from "@/shared/presentation/skeletons";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/presentation/ui/table";
import type {
  AgingView,
  CampaignTotalsView,
  CustomerStatementView,
  StatementLineView,
} from "../application/statement-view";
import {
  Figure,
  Figures,
  StatementFiguresSkeleton,
  SourceNotice,
  SourceNoticeSkeleton,
  StatusBadge,
} from "./statement-parts";
import {
  CREDIT_KINDS,
  describeLine,
  documentLabel,
  invoiceLabel,
  withRunningBalance,
} from "./statement-text";

/**
 * One customer's movements with a running balance: deliveries and charges add, payments and
 * returns subtract. `extendFor` lets administration give the customer more time per campaign (D37).
 */
export function CustomerStatement({
  statement,
  extendFor,
}: {
  statement: CustomerStatementView;
  extendFor?: { customerId: string };
}) {
  const { totals } = statement;
  const rows = withRunningBalance(statement.lines);
  const hasOther = !Money.parse(totals.other).isZero();
  const overdue = statement.overdue && Money.parse(statement.overdue).isPositive() ? statement.overdue : null;

  return (
    <div className="flex flex-col gap-6">
      <SourceNotice source={statement.source} />
      <Figures>
        <Figure label="Entregas" value={formatUsd(totals.delivered)} />
        <Figure label="Pagos" value={formatUsd(totals.paid)} />
        <Figure label="Devoluciones" value={formatUsd(totals.returned)} />
        {hasOther && <Figure label="Cargos y otros" value={formatUsd(totals.other)} />}
        <Figure label="Deuda" value={formatUsd(totals.balance)} emphasis={totals.status === "owing"} />
        {overdue && <Figure label="Vencida" value={formatUsd(overdue)} emphasis />}
      </Figures>

      {statement.aging && totals.status === "owing" && <AgingFigures aging={statement.aging} />}
      {statement.byCampaign && statement.byCampaign.length > 0 && (
        <CampaignBreakdown campaigns={statement.byCampaign} extendFor={extendFor} />
      )}

      {rows.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">Sin movimientos.</p>
      ) : (
        <>
          <WideOnly>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">T/C</TableHead>
                  <TableHead className="text-right">Entrega / cargo</TableHead>
                  <TableHead className="text-right">Pago / dev.</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ line, balance: running }, index) => (
                  <TableRow key={index}>
                    <TableCell className="tabular-nums">{line.date ? formatDate(line.date) : "—"}</TableCell>
                    <TableCell className="tabular-nums">
                      <DocumentCell line={line} />
                      {invoiceLabel(line) && (
                        <span className="block text-xs text-muted-foreground">{invoiceLabel(line)}</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <Detail line={line} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.quantity ? formatQuantity(line.quantity) : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.unitPrice ? formatMoney(line.unitPrice) : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.exchangeRate ? formatRate(line.exchangeRate) : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {CREDIT_KINDS.has(line.kind) ? "" : formatMoney(line.amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {CREDIT_KINDS.has(line.kind) ? formatMoney(line.amount) : ""}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(running)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={6}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(
                      Money.parse(totals.delivered).add(Money.parse(totals.other)).toDecimalString(),
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(
                      Money.parse(totals.paid).add(Money.parse(totals.returned)).toDecimalString(),
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    <span className="mr-2">{formatMoney(totals.balance)}</span>
                    <StatusBadge status={totals.status} />
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </WideOnly>
          <CardList label="Movimientos">
            {rows.map(({ line, balance: running }, index) => (
              <CardListItem key={index}>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {line.date ? formatDate(line.date) : "Sin fecha"}
                  {documentLabel(line) && (
                    <>
                      {" · "}
                      <DocumentCell line={line} />
                    </>
                  )}
                  {invoiceLabel(line) && ` · ${invoiceLabel(line)}`}
                </span>
                <span>
                  <Detail line={line} withRate />
                </span>
                {line.quantity && line.unitPrice && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatQuantity(line.quantity)} × {formatMoney(line.unitPrice)}
                    {line.exchangeRate && ` · T/C ${formatRate(line.exchangeRate)}`}
                  </span>
                )}
                <CardField label={CREDIT_KINDS.has(line.kind) ? "Pago / dev." : "Entrega / cargo"}>
                  {formatMoney(line.amount)}
                </CardField>
                <CardField label="Saldo">
                  <span className="font-medium">{formatMoney(running)}</span>
                </CardField>
              </CardListItem>
            ))}
            <CardListItem className="bg-muted/50">
              <div className="flex items-center justify-between gap-3 font-medium">
                <span>Total</span>
                <StatusBadge status={totals.status} />
              </div>
              <CardField label="Entregas y cargos">
                {formatMoney(Money.parse(totals.delivered).add(Money.parse(totals.other)).toDecimalString())}
              </CardField>
              <CardField label="Pagos y devoluciones">
                {formatMoney(Money.parse(totals.paid).add(Money.parse(totals.returned)).toDecimalString())}
              </CardField>
              <CardField label="Saldo">
                <span className="font-semibold">{formatMoney(totals.balance)}</span>
              </CardField>
            </CardListItem>
          </CardList>
        </>
      )}
    </div>
  );
}

/** `CustomerStatement` while it loads: the source, the four figures and the movements. */
export function CustomerStatementSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <SourceNoticeSkeleton />
      <StatementFiguresSkeleton />
      <TableSkeleton
        rows={9}
        columns={[
          { shape: "short" },
          { shape: "code" },
          { shape: "text" },
          { shape: "code", align: "right" },
          { shape: "short", align: "right" },
          { shape: "code", align: "right" },
          { shape: "short", align: "right" },
          { shape: "short", align: "right" },
          { shape: "short", align: "right" },
        ]}
      />
      <CardListSkeleton lines={3} />
    </div>
  );
}

function DocumentCell({ line }: { line: StatementLineView }) {
  const label = documentLabel(line);
  if (!label) return <>—</>;
  if (line.document?.type === "payment") {
    return (
      <Link href={paymentPath(line.document.id)} className="font-medium hover:text-primary">
        {label}
      </Link>
    );
  }
  if (line.document?.type === "note") {
    return (
      <Link href={notePath(line.document.id)} className="font-medium hover:text-primary">
        {label}
      </Link>
    );
  }
  return <>{label}</>;
}

/** The wide table has a "T/C" column; cards show a payment's rate in its text. */
function Detail({ line, withRate = false }: { line: StatementLineView; withRate?: boolean }) {
  const { text, note } = describeLine(line, { withRate });
  return (
    <>
      {text}
      {note && <span className="block text-xs text-muted-foreground">{note}</span>}
    </>
  );
}

function AgingFigures({ aging }: { aging: AgingView }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Antigüedad de la deuda</h3>
      <Figures>
        <Figure label="Hasta 30 días" value={formatUsd(aging.upTo30)} />
        <Figure label="31 a 60 días" value={formatUsd(aging.upTo60)} />
        <Figure label="61 a 90 días" value={formatUsd(aging.upTo90)} />
        <Figure label="Más de 90 días" value={formatUsd(aging.over90)} emphasis={Number(aging.over90) > 0} />
      </Figures>
    </section>
  );
}

/** "30/11/2026", and whether it is the customer's extra time. */
function DueDate({ campaign }: { campaign: CampaignTotalsView }) {
  return (
    <>
      <span className="tabular-nums">{formatDate(campaign.dueOn)}</span>
      {campaign.extension && (
        <span className="block text-xs text-muted-foreground" title={campaign.extension.reason}>
          Con más plazo
        </span>
      )}
    </>
  );
}

function CampaignBreakdown({
  campaigns,
  extendFor,
}: {
  campaigns: CampaignTotalsView[];
  extendFor?: { customerId: string };
}) {
  const extension = (campaign: CampaignTotalsView) =>
    extendFor && (
      <ExtensionButton
        customerId={extendFor.customerId}
        campaignId={campaign.campaignId}
        campaignLabel={campaignLabel(campaign)}
        campaignDueOn={campaign.campaignDueOn}
        current={campaign.extension}
      />
    );
  const isOverdue = (campaign: CampaignTotalsView) => Money.parse(campaign.overdue).isPositive();
  // Part of the balance is interest when payments haven't covered it yet (D45).
  const interestNote = (campaign: CampaignTotalsView) =>
    Money.parse(campaign.interestOwed).isPositive() && (
      <span className="block text-xs font-normal text-muted-foreground">
        con {formatMoney(campaign.interestOwed)} de interés
      </span>
    );
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Por campaña</h3>
      <WideOnly>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaña</TableHead>
              <TableHead className="text-right">Entrega</TableHead>
              <TableHead className="text-right">Pago</TableHead>
              <TableHead className="text-right">Dev.</TableHead>
              <TableHead className="text-right">Otros</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead>Estado</TableHead>
              {extendFor && (
                <TableHead className="print:hidden">
                  <span className="sr-only">Plazo</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => (
              <TableRow key={campaign.campaignId}>
                <TableCell>{campaignLabel(campaign)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(campaign.totals.delivered)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(campaign.totals.paid)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(campaign.totals.returned)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(campaign.totals.other)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(campaign.totals.balance)}
                  {interestNote(campaign)}
                </TableCell>
                <TableCell>
                  <DueDate campaign={campaign} />
                </TableCell>
                <TableCell>
                  {isOverdue(campaign) ? (
                    <Badge variant="destructive">Vencida</Badge>
                  ) : (
                    <StatusBadge status={campaign.totals.status} />
                  )}
                </TableCell>
                {extendFor && <TableCell className="print:hidden">{extension(campaign)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </WideOnly>
      <CardList label="Por campaña">
        {campaigns.map((campaign) => (
          <CardListItem key={campaign.campaignId}>
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{campaignLabel(campaign)}</span>
              {isOverdue(campaign) ? (
                <Badge variant="destructive">Vencida</Badge>
              ) : (
                <StatusBadge status={campaign.totals.status} />
              )}
            </div>
            <CardField label="Entrega">{formatMoney(campaign.totals.delivered)}</CardField>
            <CardField label="Pago">{formatMoney(campaign.totals.paid)}</CardField>
            <CardField label="Devolución">{formatMoney(campaign.totals.returned)}</CardField>
            <CardField label="Otros">{formatMoney(campaign.totals.other)}</CardField>
            <CardField label="Saldo">
              <span className="font-medium">{formatMoney(campaign.totals.balance)}</span>
              {interestNote(campaign)}
            </CardField>
            <CardField label="Vence">
              <DueDate campaign={campaign} />
            </CardField>
            {extendFor && <div className="print:hidden">{extension(campaign)}</div>}
          </CardListItem>
        ))}
      </CardList>
    </section>
  );
}
