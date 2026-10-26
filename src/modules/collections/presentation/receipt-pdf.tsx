import "server-only";
import { Text, View } from "@react-pdf/renderer";
import { campaignLabel } from "@/modules/campaigns/presentation/campaign-labels";
import { formatCustomerCode } from "@/modules/customers/domain/customer";
import { formatDate, formatMoney, formatRate } from "@/shared/presentation/format";
import { PdfFields, PdfPage, PdfTable, pdfResponse, pdfStyles } from "@/shared/presentation/pdf";
import { requireActor } from "@/modules/identity/presentation/current-user";
import { getDb } from "@/shared/infrastructure/db/client";
import { notFoundAsNull } from "@/shared/presentation/not-found";
import type { PaymentView } from "../application/collection-ports";
import { getPayment } from "../application/collection-use-cases";
import { collectionDeps } from "./collection-deps";
import { METHOD_LABELS, formatAmount } from "./collection-labels";

/** A field only when it has a value, so the receipt doesn't list what doesn't apply. */
function optional(label: string, value: string | null): [string, string][] {
  return value ? [[label, value]] : [];
}

/** The receipt Agrosoy hands over for a payment, with where it was applied. */
export function ReceiptPdf({ payment }: { payment: PaymentView }) {
  return (
    <PdfPage
      title={`RECIBO N.º ${payment.receiptNumber}`}
      subtitle={formatDate(payment.paymentDate)}
      stamp={payment.status === "voided" ? "ANULADO" : null}
    >
      <PdfFields
        items={[
          ["Recibimos de", `${formatCustomerCode(payment.customer.code)} · ${payment.customer.name}`],
          ["La suma de", formatAmount(payment.currency, payment.amount)],
          ...optional(
            "Equivalente",
            payment.currency === "BOB"
              ? `US$ ${formatMoney(payment.usdAmount)} a ${formatRate(payment.exchangeRate)} Bs por US$`
              : null,
          ),
          [
            "Forma de pago",
            `${METHOD_LABELS[payment.method]}${payment.inKindDescription ? ` · ${payment.inKindDescription}` : ""}`,
          ],
          ...optional("Referencia", payment.reference),
          ...optional("Boleta al contado", payment.settlesNote ? `N.º ${payment.settlesNote.number}` : null),
        ]}
      />
      <PdfTable
        columns={[
          { header: "Aplicado a", width: "75%" },
          { header: "US$", width: "25%", align: "right" },
        ]}
        rows={payment.allocations.map((allocation) => [
          `Campaña ${campaignLabel(allocation.campaign)}${allocation.note ? `, boleta N.º ${allocation.note.number}` : ""}`,
          formatMoney(allocation.usdAmount),
        ])}
        footer={["Total", formatMoney(payment.usdAmount)]}
      />
      {payment.observations && (
        <View style={{ marginBottom: 8 }}>
          <Text style={pdfStyles.label}>Observaciones</Text>
          <Text>{payment.observations}</Text>
        </View>
      )}
      {payment.voided && <Text style={pdfStyles.muted}>Motivo de la anulación: {payment.voided.reason}</Text>}
      <View style={[pdfStyles.signatures, { justifyContent: "flex-end" }]}>
        <View style={pdfStyles.signature}>
          <Text>Recibí conforme</Text>
          <Text style={pdfStyles.muted}>
            Agrosoy{payment.recorded.byName ? ` · ${payment.recorded.byName}` : ""}
          </Text>
        </View>
      </View>
    </PdfPage>
  );
}

/** The receipt as a PDF, for administration; 404 when it doesn't exist. */
export async function receiptPdfResponse(paymentId: string): Promise<Response> {
  const actor = await requireActor();
  const payment = await getPayment(collectionDeps(getDb()), actor, paymentId).catch(notFoundAsNull);
  if (!payment) return new Response("No encontrado", { status: 404 });
  return pdfResponse(<ReceiptPdf payment={payment} />, `recibo-${payment.receiptNumber}.pdf`);
}
