import "server-only";
import { Text, View } from "@react-pdf/renderer";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { Money } from "@/shared/domain/money";
import { formatDate, formatMoney, formatQuantity } from "@/shared/presentation/format";
import { PdfFields, PdfPage, PdfTable, pdfResponse, pdfStyles } from "@/shared/presentation/pdf";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { todayInBolivia } from "@/shared/presentation/business-date";
import { notFoundAsNull } from "@/shared/presentation/not-found";
import { customerStatement } from "../application/statement-use-cases";
import type { CustomerStatementView } from "../application/statement-view";
import { statementDeps } from "./statement-deps";
import { CREDIT_KINDS, describeLine, documentLabel, withRunningBalance } from "./statement-text";

const STATUS_LABELS = { owing: "Debe", settled: "Cancelado" } as const;

/** The customer statement to send: totals, per campaign, age of the debt and every movement. */
export function StatementPdf({
  statement,
  scope,
  asOf,
}: {
  statement: CustomerStatementView;
  /** "Todas las campañas" or "Campaña Verano 2026". */
  scope: string;
  asOf: string;
}) {
  const { totals } = statement;
  const hasOther = !Money.parse(totals.other).isZero();

  return (
    <PdfPage
      title="ESTADO DE CUENTA"
      subtitle={`${statement.customerName} · ${scope} · al ${formatDate(asOf)}`}
    >
      <PdfFields
        items={[
          ["Entregas", `US$ ${formatMoney(totals.delivered)}`],
          ["Pagos", `US$ ${formatMoney(totals.paid)}`],
          ["Devoluciones", `US$ ${formatMoney(totals.returned)}`],
          ...(hasOther ? [["Cargos y otros", `US$ ${formatMoney(totals.other)}`] as [string, string]] : []),
          ["Deuda", `US$ ${formatMoney(totals.balance)} · ${STATUS_LABELS[totals.status]}`],
        ]}
      />

      {statement.aging && totals.status === "owing" && (
        <PdfFields
          items={[
            ["Hasta 30 días", `US$ ${formatMoney(statement.aging.upTo30)}`],
            ["31 a 60 días", `US$ ${formatMoney(statement.aging.upTo60)}`],
            ["61 a 90 días", `US$ ${formatMoney(statement.aging.upTo90)}`],
            ["Más de 90 días", `US$ ${formatMoney(statement.aging.over90)}`],
          ]}
        />
      )}

      {statement.byCampaign && statement.byCampaign.length > 1 && (
        <PdfTable
          columns={[
            { header: "Campaña", width: "25%" },
            { header: "Entrega", width: "15%", align: "right" },
            { header: "Pago", width: "15%", align: "right" },
            { header: "Dev.", width: "15%", align: "right" },
            { header: "Otros", width: "15%", align: "right" },
            { header: "Saldo", width: "15%", align: "right" },
          ]}
          rows={statement.byCampaign.map((campaign) => [
            campaignLabel(campaign),
            formatMoney(campaign.totals.delivered),
            formatMoney(campaign.totals.paid),
            formatMoney(campaign.totals.returned),
            formatMoney(campaign.totals.other),
            formatMoney(campaign.totals.balance),
          ])}
        />
      )}

      <View>
        <Text style={[pdfStyles.label, { marginBottom: 4 }]}>Detalle</Text>
        <PdfTable
          columns={[
            { header: "Fecha", width: "11%" },
            { header: "Documento", width: "12%" },
            { header: "Detalle", width: "31%" },
            { header: "Cant.", width: "8%", align: "right" },
            { header: "Precio", width: "9%", align: "right" },
            { header: "Entrega / cargo", width: "10%", align: "right" },
            { header: "Pago / dev.", width: "9%", align: "right" },
            { header: "Saldo", width: "10%", align: "right" },
          ]}
          rows={withRunningBalance(statement.lines).map(({ line, balance }) => {
            const { text, note } = describeLine(line);
            const isCredit = CREDIT_KINDS.has(line.kind);
            return [
              line.date ? formatDate(line.date) : "—",
              documentLabel(line),
              note ? `${text}\n${note}` : text,
              line.quantity ? formatQuantity(line.quantity) : "",
              line.unitPrice ? formatMoney(line.unitPrice) : "",
              isCredit ? "" : formatMoney(line.amount),
              isCredit ? formatMoney(line.amount) : "",
              formatMoney(balance),
            ];
          })}
          footer={[
            "Total",
            "",
            "",
            "",
            "",
            formatMoney(Money.parse(totals.delivered).add(Money.parse(totals.other)).toDecimalString()),
            formatMoney(Money.parse(totals.paid).add(Money.parse(totals.returned)).toDecimalString()),
            formatMoney(totals.balance),
          ]}
        />
      </View>
    </PdfPage>
  );
}

/** A customer's statement as a PDF, for every campaign or one; 404 when the customer doesn't exist. */
export async function statementPdfResponse(customerId: string, campaignId: string | null): Promise<Response> {
  const actor = await requireActor();
  const statement = await customerStatement(statementDeps(), actor, customerId, {
    campaignId: campaignId ?? undefined,
  }).catch(notFoundAsNull);
  if (!statement) return new Response("No encontrado", { status: 404 });
  const campaign = statement.campaigns.find((option) => option.id === campaignId);
  const scope = campaign ? `Campaña ${campaignLabel(campaign)}` : "Todas las campañas";
  const today = todayInBolivia();
  return pdfResponse(
    <StatementPdf statement={statement} scope={scope} asOf={today} />,
    `estado-de-cuenta-${fileSlug(statement.customerName)}-${today}.pdf`,
  );
}

/** "Agro Sur Ñandú" becomes "agro-sur-nandu", safe in a file name. */
function fileSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
